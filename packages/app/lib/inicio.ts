/** Lo mínimo de la sesión que decide a dónde llega cada usuario. */
export type UsuarioInicio = {
  esSuperAdmin: boolean;
  esAdminFirma: boolean;
  /** Firma con la que trabaja ahora; vacía mientras no haya elegido una. */
  firmaContableId: string;
};

/** Un superadmin que todavía no eligió una firma no tiene "su" cartera: primero elige en Firmas. */
export const superadminSinFirma = (u: UsuarioInicio) => u.esSuperAdmin && !u.firmaContableId;

/**
 * Página de inicio por rol. Sin firma elegida: el superadmin elige en Firmas y quien pertenece a
 * varias firmas elige en `/elegir-firma`. Con firma: el admin parte en su firma y desde allí llega
 * a sus empresas, y el resto va directo a las empresas que tiene asignadas. Quien pertenece a una
 * sola firma la tiene elegida desde el inicio.
 */
export function rutaInicial(u: UsuarioInicio): string {
  if (!u.firmaContableId) return u.esSuperAdmin ? "/superadmin/firmas" : "/elegir-firma";
  if (u.esAdminFirma) return "/admin/firmas";
  return "/admin/empresas";
}
