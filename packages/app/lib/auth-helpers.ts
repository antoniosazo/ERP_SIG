import { obtenerEmpresa, type AuditoriaCtx } from "@erp/db";
import { auth } from "@/auth";
import type { Session } from "next-auth";

type Empresa = NonNullable<Awaited<ReturnType<typeof obtenerEmpresa>>>;

/** Contexto de auditoría a partir de la sesión, para pasar a las queries de mutación. */
export function auditCtx(session: Session, motivo?: string): AuditoriaCtx {
  return {
    usuarioId: session.user.id,
    usuarioNombre: session.user.name ?? "—",
    ...(motivo ? { motivo } : {}),
  };
}

/** Sesión o null — para Server Components/Actions que necesitan saber si hay usuario logueado. */
export async function obtenerSesion(): Promise<Session | null> {
  return auth();
}

/** Exige sesión. Lanza si no hay — úsalo al inicio de Server Actions que escriben datos. */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new Error("No hay sesión activa");
  return session;
}

/** Exige que el usuario sea Administrador de la firma (gestión de usuarios, datos de la firma). */
export async function requireAdminFirma(): Promise<Session> {
  const session = await requireSession();
  if (!session.user.esAdminFirma) {
    throw new Error("Se requiere ser Administrador de la firma para esta acción");
  }
  return session;
}

/**
 * Acceso de lectura al entorno de una empresa (`/panel/[empresaId]`). No lanza: devuelve
 * `null` cuando no hay sesión, la empresa no existe, no pertenece a la firma del usuario,
 * o el usuario no es Administrador de firma ni tiene la empresa asignada en `usuario_empresa`.
 * Los layouts la usan para hacer `notFound()`.
 */
export async function obtenerAccesoEmpresa(
  empresaId: string,
): Promise<{ session: Session; empresa: Empresa; rol: string | null } | null> {
  const session = await auth();
  if (!session?.user) return null;

  const empresa = await obtenerEmpresa(empresaId);
  if (!empresa || empresa.firmaContableId !== session.user.firmaContableId) return null;

  const asignacion = session.user.empresas.find((e) => e.empresaId === empresaId);
  if (!session.user.esAdminFirma && !asignacion) return null;

  return { session, empresa, rol: asignacion?.rol ?? null };
}

/** Exige que el usuario tenga uno de los roles indicados en esa empresa cliente (o sea Admin de firma). */
export async function requireRolEnEmpresa(
  empresaId: string,
  rolesPermitidos: string[],
): Promise<Session> {
  const session = await requireSession();
  if (session.user.esAdminFirma) {
    // El atajo de Admin de firma solo aplica a empresas de SU PROPIA firma: sin este
    // chequeo, el admin de una firma podría operar sobre empresas de otra firma con solo
    // conocer su empresaId (cross-tenant).
    const empresa = await obtenerEmpresa(empresaId);
    if (!empresa || empresa.firmaContableId !== session.user.firmaContableId) {
      throw new Error("No tienes el rol necesario para esta acción en esta empresa");
    }
    return session;
  }

  const asignacion = session.user.empresas.find((e) => e.empresaId === empresaId);
  if (!asignacion || !rolesPermitidos.includes(asignacion.rol)) {
    throw new Error("No tienes el rol necesario para esta acción en esta empresa");
  }
  return session;
}

/** Exige que el usuario sea superadmin del sistema (crear/gestionar firmas contables). */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.user.esSuperAdmin) {
    throw new Error("Se requiere ser superadmin del sistema para esta acción");
  }
  return session;
}
