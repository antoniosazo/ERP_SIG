import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

/**
 * Se usa `neon-serverless` (Pool sobre WebSocket) en vez de `neon-http` porque
 * necesitamos transacciones interactivas reales (ej. crear empresa + clonar plan
 * de cuentas + abrir primer periodo, todo o nada) — ver decisión de diseño 5 del plan.
 */
neonConfig.webSocketConstructor = ws;

function crearPool(connectionString: string) {
  return new Pool({ connectionString });
}

let poolSingleton: Pool | undefined;

function obtenerPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida");
  }
  poolSingleton ??= crearPool(connectionString);
  return poolSingleton;
}

export const db = drizzle(obtenerPool(), { schema });

export type Database = typeof db;
/** Tipo del `tx` recibido dentro de `db.transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
