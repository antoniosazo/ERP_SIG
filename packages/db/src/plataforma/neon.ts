import type { ConexionesFirma } from "./cripto";

/**
 * Cliente mínimo de la API de Neon (https://api-docs.neon.tech): solo crear el proyecto de una
 * firma. El borrado se hace a mano desde la consola, a propósito. Requiere `NEON_API_KEY` y
 * `NEON_ORG_ID`; `NEON_REGION` es opcional. La key puede crear proyectos: solo debe existir en el
 * servidor y en los scripts de alta, nunca en el navegador.
 */

const API = "https://console.neon.tech/api/v2";
/** AWS South America East 1 (São Paulo): la región más cercana a Chile. */
export const REGION_NEON_POR_DEFECTO = "aws-sa-east-1";
const VERSION_POSTGRES = 18;
const INTENTOS = 4;

function variable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`${nombre} no está definida (revisa tu archivo .env)`);
  return valor;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Llamada a la API con reintento ante límites de tasa y fallas del servidor (no ante errores del pedido). */
async function llamar<T>(ruta: string, init: { method: string; body?: unknown }): Promise<T> {
  let ultimo = "";
  for (let intento = 1; intento <= INTENTOS; intento++) {
    const r = await fetch(`${API}${ruta}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${variable("NEON_API_KEY")}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (r.ok) return (await r.json()) as T;
    const cuerpo = (await r.json().catch(() => ({}))) as { message?: string };
    ultimo = `Neon respondió ${r.status}: ${cuerpo.message ?? r.statusText}`;
    if (r.status !== 429 && r.status < 500) break;
    if (intento < INTENTOS) await esperar(500 * 2 ** intento);
  }
  throw new Error(ultimo);
}

type RespuestaCrearProyecto = {
  project: { id: string; region_id: string };
  connection_uris: {
    connection_parameters: { host: string; pooler_host: string; database: string; role: string; password: string };
  }[];
};

// verify-full: cifra y verifica el certificado y el host. Con `pg` 9 "require" dejará de verificarlos.
const url = (p: { host: string; database: string; role: string; password: string }) =>
  `postgresql://${encodeURIComponent(p.role)}:${encodeURIComponent(p.password)}@${p.host}/${encodeURIComponent(p.database)}?sslmode=verify-full`;

/** Crea el proyecto Neon de una firma y devuelve sus conexiones (con pooler para la app, directa para migrar). */
export async function crearProyectoNeon(opciones: { nombre: string; region?: string | null }): Promise<{
  proyectoId: string;
  region: string;
  baseDatos: string;
  conexiones: ConexionesFirma;
}> {
  const region = opciones.region ?? process.env.NEON_REGION ?? REGION_NEON_POR_DEFECTO;
  const r = await llamar<RespuestaCrearProyecto>("/projects", {
    method: "POST",
    body: {
      project: {
        name: opciones.nombre.slice(0, 64),
        region_id: region,
        pg_version: VERSION_POSTGRES,
        org_id: variable("NEON_ORG_ID"),
      },
    },
  });
  const p = r.connection_uris[0]?.connection_parameters;
  if (!p) throw new Error(`Neon creó el proyecto ${r.project.id} pero no devolvió su conexión.`);
  return {
    proyectoId: r.project.id,
    region: r.project.region_id,
    baseDatos: p.database,
    conexiones: { app: url({ ...p, host: p.pooler_host }), directa: url(p) },
  };
}
