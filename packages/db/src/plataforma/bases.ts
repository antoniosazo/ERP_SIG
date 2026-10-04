import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { sembrarCatalogos } from "../catalogos";
import { conexionesDeFirma, dbDeUrl, dbPlataforma, olvidarConexionFirma, poolDeUrl, urlConBase, VERSION_ESQUEMA_FIRMA } from "../client";
import { tiposDocumento } from "../schema";
import { cifrarConexiones, type ConexionesFirma } from "./cripto";
import { crearProyectoNeon } from "./neon";
import { firmasContables } from "./schema";

/**
 * Ciclo de vida de las bases: la de plataforma y una por firma (un proyecto Neon por firma,
 * o una base en un Postgres propio en desarrollo). Las migraciones se aplican fuera de la app
 * (script `db:migrate`), nunca al arrancar ni al compilar. Mientras la base de una firma no
 * esté "lista", la app no la usa.
 */

// Rutas calculadas al usarse (solo scripts): dentro del bundle de la app no hay carpeta de migraciones.
const carpetaMigraciones = (esquema: "plataforma" | "firma") =>
  path.resolve(import.meta.dirname, "..", "..", "migrations", esquema);

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`${nombre} no está definida (revisa tu archivo .env)`);
  return valor;
}

/** Proveedor con que se crean las firmas nuevas (`FIRMAS_PROVEEDOR`): `neon` en la nube, `servidor` en local. */
export function proveedorPorDefecto(): "neon" | "servidor" {
  const valor = process.env.FIRMAS_PROVEEDOR ?? "neon";
  if (valor !== "neon" && valor !== "servidor") throw new Error(`FIRMAS_PROVEEDOR inválido: ${valor} (usa "neon" o "servidor").`);
  return valor;
}

/** Etiqueta de la última migración de firma, que es la versión de esquema esperada. */
export function versionEsquemaFirma(): string {
  if (!VERSION_ESQUEMA_FIRMA) throw new Error("No hay migraciones de firma.");
  return VERSION_ESQUEMA_FIRMA;
}

/** Nombre de la base de una firma en un servidor propio: estable, sin datos personales y válido en Postgres. */
export function nombreBaseFirma(firmaId: string): string {
  return `firma_${firmaId.replace(/-/g, "")}`;
}

export async function migrarPlataforma() {
  await migrate(dbPlataforma, { migrationsFolder: carpetaMigraciones("plataforma") });
}

const identificador = (nombre: string) => {
  if (!/^[a-z0-9_]+$/.test(nombre)) throw new Error(`Nombre de base inválido: ${nombre}`);
  return `"${nombre}"`;
};

/** Base vacía en el servidor propio (`FIRMAS_DATABASE_URL`), si todavía no existe. */
async function crearBaseEnServidor(firmaId: string): Promise<{ baseDatos: string; conexiones: ConexionesFirma }> {
  const servidorUrl = variable("FIRMAS_DATABASE_URL");
  const baseDatos = nombreBaseFirma(firmaId);
  const servidor = poolDeUrl(servidorUrl);
  const existe = await servidor.query("select 1 from pg_database where datname = $1", [baseDatos]);
  if (existe.rowCount === 0) await servidor.query(`create database ${identificador(baseDatos)}`);
  const url = urlConBase(servidorUrl, baseDatos);
  return { baseDatos, conexiones: { app: url, directa: url } };
}

/** Un proyecto recién creado tarda unos segundos en aceptar conexiones. */
async function esperarConexion(url: string, maxMs = 120_000) {
  const limite = Date.now() + maxMs;
  for (;;) {
    const cliente = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
    try {
      await cliente.connect();
      await cliente.query("select 1");
      return;
    } catch (error) {
      if (Date.now() > limite) throw error;
      await new Promise((r) => setTimeout(r, 3_000));
    } finally {
      await cliente.end().catch(() => {});
    }
  }
}

/**
 * Crea la base de la firma según su proveedor y guarda su conexión cifrada. Es reentrante: si
 * la firma ya tiene conexión (un intento anterior creó el proyecto y falló después), la reutiliza
 * en vez de crear otro proyecto.
 */
async function crearBaseDeFirma(firmaId: string) {
  const [firma] = await dbPlataforma
    .select({
      razonSocial: firmasContables.razonSocial,
      proveedor: firmasContables.proveedor,
      region: firmasContables.region,
      conexionCifrada: firmasContables.conexionCifrada,
    })
    .from(firmasContables)
    .where(eq(firmasContables.id, firmaId));
  if (!firma) throw new Error("La firma contable no existe.");
  if (firma.conexionCifrada) return;
  if (firma.proveedor === "neon") {
    const p = await crearProyectoNeon({ nombre: `ERP ${firma.razonSocial}`, region: firma.region });
    // Se registra apenas existe: si algo falla después, el proyecto queda identificado para reintentar o borrarlo a mano.
    await dbPlataforma
      .update(firmasContables)
      .set({ neonProyectoId: p.proyectoId, region: p.region, baseDatos: p.baseDatos, conexionCifrada: cifrarConexiones(p.conexiones), updatedAt: new Date() })
      .where(eq(firmasContables.id, firmaId));
    await esperarConexion(p.conexiones.directa);
    return;
  }
  const b = await crearBaseEnServidor(firmaId);
  await dbPlataforma
    .update(firmasContables)
    .set({ baseDatos: b.baseDatos, conexionCifrada: cifrarConexiones(b.conexiones), updatedAt: new Date() })
    .where(eq(firmasContables.id, firmaId));
}

/**
 * Lleva la base de una firma a la última versión de esquema (con la conexión directa: el pooler
 * no admite todo lo que hace una migración). Registra el resultado en la plataforma; si falla,
 * la firma queda en "error" (y fuera de servicio) sin afectar a las demás.
 */
export async function migrarBaseFirma(
  firmaId: string,
  opciones: { despuesDeMigrar?: (base: ReturnType<typeof dbDeUrl>) => Promise<void> } = {},
): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  const version = versionEsquemaFirma();
  try {
    const base = dbDeUrl((await conexionesDeFirma(firmaId, { exigirLista: false })).directa);
    await migrate(base, { migrationsFolder: carpetaMigraciones("firma") });
    await opciones.despuesDeMigrar?.(base);
    await dbPlataforma
      .update(firmasContables)
      .set({ estadoBase: "lista", versionEsquema: version, migradaEn: new Date(), errorMigracion: null, updatedAt: new Date() })
      .where(eq(firmasContables.id, firmaId));
    return { ok: true, version };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    await dbPlataforma
      .update(firmasContables)
      .set({ estadoBase: "error", errorMigracion: mensaje, updatedAt: new Date() })
      .where(eq(firmasContables.id, firmaId));
    return { ok: false, error: mensaje };
  } finally {
    olvidarConexionFirma(firmaId);
  }
}

/** Alta de la base de una firma ya registrada: la crea, la migra y siembra los catálogos. */
export async function prepararBaseFirma(firmaId: string) {
  try {
    await crearBaseDeFirma(firmaId);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    await dbPlataforma
      .update(firmasContables)
      .set({ estadoBase: "error", errorMigracion: mensaje, updatedAt: new Date() })
      .where(eq(firmasContables.id, firmaId));
    throw new Error(`No se pudo crear la base de la firma: ${mensaje}`);
  }
  const r = await migrarBaseFirma(firmaId, {
    // Antes de marcarla "lista": la app no debe ver una base sin catálogos.
    despuesDeMigrar: async (base) => {
      const yaSembrada = await base.select({ id: tiposDocumento.id }).from(tiposDocumento).limit(1);
      if (yaSembrada.length === 0) await sembrarCatalogos(base);
    },
  });
  if (!r.ok) throw new Error(`No se pudo preparar la base de la firma: ${r.error}`);
}

/**
 * Migra todas las firmas que ya tienen base, de a una. Se detiene si fallan más de `maxErrores`:
 * un error repetido suele ser la migración, no la firma, y conviene no propagarlo a todas.
 */
export async function migrarTodasLasFirmas(opciones: { maxErrores?: number; alAvanzar?: (linea: string) => void } = {}) {
  const maxErrores = opciones.maxErrores ?? 3;
  const firmas = await dbPlataforma
    .select({ id: firmasContables.id, razonSocial: firmasContables.razonSocial, conexionCifrada: firmasContables.conexionCifrada })
    .from(firmasContables)
    .orderBy(asc(firmasContables.razonSocial));
  const resultado = { migradas: 0, sinBase: 0, errores: [] as { firma: string; error: string }[] };
  for (const firma of firmas) {
    if (!firma.conexionCifrada) {
      resultado.sinBase++;
      opciones.alAvanzar?.(`· ${firma.razonSocial}: sin base todavía (reintenta su alta)`);
      continue;
    }
    const r = await migrarBaseFirma(firma.id);
    if (r.ok) {
      resultado.migradas++;
      opciones.alAvanzar?.(`✓ ${firma.razonSocial} → ${r.version}`);
    } else {
      resultado.errores.push({ firma: firma.razonSocial, error: r.error });
      opciones.alAvanzar?.(`✗ ${firma.razonSocial}: ${r.error}`);
      if (resultado.errores.length >= maxErrores) {
        opciones.alAvanzar?.(`Se detuvo tras ${maxErrores} errores.`);
        break;
      }
    }
  }
  return resultado;
}
