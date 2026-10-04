import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de las conexiones de cada firma (contienen la contraseña de su base). AES-256-GCM
 * con `FIRMAS_CONEXION_KEY` (32 bytes en base64). Formato: `ivB64:tagB64:ctB64`.
 * Si la clave se pierde, las conexiones de Neon se pueden volver a obtener desde su API.
 */
function clave(): Buffer {
  const raw = process.env.FIRMAS_CONEXION_KEY;
  if (!raw) throw new Error("Falta FIRMAS_CONEXION_KEY (32 bytes en base64) para cifrar las conexiones de las firmas.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("FIRMAS_CONEXION_KEY debe ser exactamente 32 bytes (base64).");
  return key;
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave(), iv);
  const ct = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ct.toString("base64")}`;
}

export function descifrar(blob: string): string {
  const [iv, tag, ct] = blob.split(":");
  if (!iv || !tag || !ct) throw new Error("Conexión cifrada inválida.");
  const decipher = createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

/** Conexiones de una firma: `app` (con pooler, para las peticiones) y `directa` (migraciones). */
export type ConexionesFirma = { app: string; directa: string };

export const cifrarConexiones = (c: ConexionesFirma) => cifrar(JSON.stringify(c));

export function descifrarConexiones(blob: string): ConexionesFirma {
  const c = JSON.parse(descifrar(blob)) as Partial<ConexionesFirma>;
  if (!c.app || !c.directa) throw new Error("Conexión cifrada incompleta.");
  return { app: c.app, directa: c.directa };
}
