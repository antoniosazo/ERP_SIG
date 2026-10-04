import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma con la que está trabajando el usuario. Quien pertenece a varias firmas elige una al entrar
 * (y puede cambiarla); el superadmin entra a la que necesite. Va en una cookie firmada y ligada al
 * usuario; la sesión la vuelve a comprobar en cada petición contra las firmas a las que tiene acceso.
 */
export const COOKIE_FIRMA_ACTIVA = "erp_firma_activa";
export const VIGENCIA_FIRMA_ACTIVA_SEG = 8 * 60 * 60;

function firma(payload: string): Buffer {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto) throw new Error("AUTH_SECRET no está configurado");
  return createHmac("sha256", secreto).update(payload).digest();
}

export function crearFirmaActiva(usuarioId: string, firmaId: string, ahora = Date.now()): string {
  const expira = ahora + VIGENCIA_FIRMA_ACTIVA_SEG * 1000;
  const payload = `v2:${usuarioId}:${firmaId}:${expira}`;
  return `${Buffer.from(payload).toString("base64url")}.${firma(payload).toString("base64url")}`;
}

/** La firma elegida si la cookie es auténtica, vigente y de este usuario; null en cualquier otro caso. */
export function verificarFirmaActiva(valor: string | undefined, usuarioId: string, ahora = Date.now()): string | null {
  if (!valor || valor.length > 512) return null;
  const partes = valor.split(".");
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  try {
    const payload = Buffer.from(partes[0], "base64url").toString("utf8");
    const recibida = Buffer.from(partes[1], "base64url");
    const esperada = firma(payload);
    if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
    const [version, usuario, firmaId, expira, extra] = payload.split(":");
    if (extra || version !== "v2" || usuario !== usuarioId || !firmaId) return null;
    const limite = Number(expira);
    if (!Number.isSafeInteger(limite) || limite <= ahora) return null;
    return firmaId;
  } catch {
    return null;
  }
}
