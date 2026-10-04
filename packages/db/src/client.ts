import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import journalFirma from "../migrations/firma/meta/_journal.json" with { type: "json" };
import { type ConexionesFirma, descifrarConexiones } from "./plataforma/cripto";
import * as esquemaPlataforma from "./plataforma/schema";
import * as schema from "./schema";

/**
 * Una base de plataforma (firmas, cuentas de usuario) y una base por firma contable.
 *
 * `db` es la base de la firma activa: cada consulta se enruta a la base de la firma de la
 * petición, resuelta por `conFirma(...)` (scripts, tareas, pruebas) o, si no hay, por el
 * resolver que registra la app con la firma de la sesión. Sin firma, falla: nunca hay una
 * base "por defecto" donde caer. Así una empresa de otra firma simplemente no existe en la
 * base consultada.
 */

const MAX_CONEXIONES = Number(process.env.FIRMAS_DB_POOL_MAX ?? 5);

/** Última migración de firma que conoce este código: la versión mínima que exige a cada base. */
export const VERSION_ESQUEMA_FIRMA = journalFirma.entries.at(-1)?.tag ?? "";
const indiceVersion = (tag: string | null) => (tag ? Number.parseInt(tag.slice(0, 4), 10) : -1);
const VIGENCIA_CONEXION_MS = 60_000;

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`${nombre} no está definida (revisa tu archivo .env)`);
  return valor;
}

/** La misma URL de servidor apuntando a otra base. */
export function urlConBase(url: string, base: string): string {
  const u = new URL(url);
  u.pathname = `/${base}`;
  return u.toString();
}

/**
 * Objeto con forma de `pg.Pool` cuyas consultas y conexiones van al pool que resuelva
 * `destino` en ese momento. drizzle solo usa `query` y `connect` (con `release`) y detecta
 * un pool por prototipo, que es lo que permite enrutar sin tocar ninguna consulta.
 */
function poolEnrutado(destino: () => Promise<pg.Pool>): pg.Pool {
  const fachada = Object.create(pg.Pool.prototype) as pg.Pool;
  Object.defineProperties(fachada, {
    connect: { value: async () => (await destino()).connect() },
    query: {
      value: async (...args: unknown[]) => {
        const pool = await destino();
        return (pool.query as (...a: unknown[]) => Promise<unknown>).apply(pool, args);
      },
    },
  });
  return fachada;
}

/**
 * Estado compartido por proceso. Next puede evaluar este módulo más de una vez (una copia por
 * capa del bundle); guardarlo en `globalThis` evita pools duplicados y un resolver que una
 * copia registró y otra no ve.
 */
const compartido = ((globalThis as { __erpBases?: Compartido }).__erpBases ??= {
  pools: new Map(),
  conexionesFirma: new Map(),
  resolverFirma: null,
  contexto: new AsyncLocalStorage(),
});
type Compartido = {
  pools: Map<string, pg.Pool>;
  conexionesFirma: Map<string, { conexiones: ConexionesFirma; vence: number }>;
  resolverFirma: (() => Promise<string | null | undefined>) | null;
  contexto: AsyncLocalStorage<{ firmaId: string }>;
};

const pools = compartido.pools;
/** Un pool por servidor+base, reutilizado entre peticiones. */
export function poolDeUrl(url: string): pg.Pool {
  let pool = pools.get(url);
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: MAX_CONEXIONES });
    pools.set(url, pool);
  }
  return pool;
}

/** Cierra todas las conexiones (scripts y pruebas). */
export async function cerrarConexiones() {
  const abiertos = [...pools.values()];
  pools.clear();
  conexionesFirma.clear();
  await Promise.all(abiertos.map((p) => p.end()));
}

// ── Plataforma ──────────────────────────────────────────────────────────────
export const dbPlataforma = drizzle(
  poolEnrutado(async () => poolDeUrl(variable("PLATAFORMA_DATABASE_URL"))),
  { schema: esquemaPlataforma },
);

// ── Firma activa ────────────────────────────────────────────────────────────
const contexto = compartido.contexto;
/** La app registra cómo obtener la firma de la petición en curso (la de la sesión). */
export function registrarResolverFirma(fn: () => Promise<string | null | undefined>) {
  compartido.resolverFirma = fn;
}

/** Ejecuta `fn` con `db` apuntando a la base de `firmaId` (tareas, scripts, pruebas). */
export function conFirma<T>(firmaId: string, fn: () => T | PromiseLike<T>): Promise<T> {
  // Las consultas de drizzle son perezosas: se ejecutan al esperarlas. Se esperan aquí,
  // dentro del contexto, para que no corran después con otra firma (o ninguna).
  return contexto.run({ firmaId }, async () => await fn());
}

export async function firmaActual(): Promise<string> {
  const firmaId = contexto.getStore()?.firmaId ?? (compartido.resolverFirma ? await compartido.resolverFirma() : null);
  if (!firmaId) throw new Error("No hay una firma activa para esta operación.");
  return firmaId;
}

const conexionesFirma = compartido.conexionesFirma;

/**
 * Conexiones de una firma según el registro de la plataforma (descifradas, cacheadas un minuto).
 * Con `exigirLista` (lo normal) falla si la base está en alta, en error o desactualizada.
 */
export async function conexionesDeFirma(firmaId: string, opciones: { exigirLista?: boolean } = {}): Promise<ConexionesFirma> {
  const exigirLista = opciones.exigirLista ?? true;
  const enCache = conexionesFirma.get(firmaId);
  if (exigirLista && enCache && enCache.vence > Date.now()) return enCache.conexiones;
  const { firmasContables } = esquemaPlataforma;
  const [firma] = await dbPlataforma
    .select({
      conexionCifrada: firmasContables.conexionCifrada,
      estadoBase: firmasContables.estadoBase,
      versionEsquema: firmasContables.versionEsquema,
    })
    .from(firmasContables)
    .where(eq(firmasContables.id, firmaId));
  if (!firma) throw new Error("La firma contable no existe.");
  if (exigirLista && firma.estadoBase !== "lista") {
    throw new Error("La base de datos de la firma no está disponible en este momento (alta o actualización en curso).");
  }
  // Una base más nueva que el código se tolera (los cambios de esquema son aditivos); una más
  // vieja no: la firma queda en mantenimiento hasta que `db:migrate` la ponga al día.
  if (exigirLista && indiceVersion(firma.versionEsquema) < indiceVersion(VERSION_ESQUEMA_FIRMA)) {
    throw new Error("La base de datos de la firma está pendiente de actualización. Intenta en unos minutos.");
  }
  if (!firma.conexionCifrada) throw new Error("La firma todavía no tiene base de datos.");
  const conexiones = descifrarConexiones(firma.conexionCifrada);
  if (exigirLista) conexionesFirma.set(firmaId, { conexiones, vence: Date.now() + VIGENCIA_CONEXION_MS });
  return conexiones;
}

/** Olvida la conexión cacheada de una firma (tras moverla de servidor o cambiar su estado). */
export function olvidarConexionFirma(firmaId: string) {
  conexionesFirma.delete(firmaId);
}

export const db = drizzle(
  poolEnrutado(async () => poolDeUrl((await conexionesDeFirma(await firmaActual())).app)),
  { schema },
);

/** Base de una firma por URL, sin pasar por el contexto (migraciones y alta de firmas). */
export function dbDeUrl(url: string) {
  return drizzle(poolDeUrl(url), { schema });
}

export type Database = typeof db;
/** Tipo del `tx` recibido dentro de `db.transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
