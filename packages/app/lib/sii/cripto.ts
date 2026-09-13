/**
 * Cifrado de credenciales del SII — módulo **solo servidor** (usa `node:crypto`).
 * AES‑256‑GCM. La clave viene de `SII_ENCRYPTION_KEY` (32 bytes en base64).
 * Formato del blob: `ivB64:tagB64:ctB64`. Nunca loguear valores descifrados.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function claveMaestra(): Buffer {
  const raw = process.env.SII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Falta SII_ENCRYPTION_KEY (32 bytes en base64) para cifrar las credenciales del SII.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SII_ENCRYPTION_KEY debe ser exactamente 32 bytes (base64).");
  }
  return key;
}

/** Devuelve `iv:tag:ct` en base64. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", claveMaestra(), iv);
  const ct = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function descifrar(blob: string): string {
  const [ivB64, tagB64, ctB64] = blob.split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Blob cifrado inválido.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    claveMaestra(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** `undefined` si el campo no está seteado; nunca lanza por blob vacío. */
export function descifrarOpcional(blob: string | null | undefined): string | undefined {
  if (!blob) return undefined;
  return descifrar(blob);
}
