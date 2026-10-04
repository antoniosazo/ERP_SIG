"use server";

import {
  type ActorGestion,
  cambiarEstadoUsuario,
  crearUsuarioInvitado,
  editarUsuario,
  generarTokenReset,
  historialDeUsuario,
  reenviarInvitacion,
} from "@erp/db";
import {
  ACCION_ESTADO_USUARIO,
  editarUsuarioSchema,
  invitarUsuarioSchema,
  uuid,
  type EditarUsuarioInput,
  type InvitarUsuarioInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { requireAdminFirma } from "@/lib/auth-helpers";
import type { HistorialResultado } from "@/lib/actions/ventas";

/** `token` es null cuando la persona ya tenía cuenta: entra con su misma contraseña y no hay link. */
export type InvitarUsuarioResultado =
  | { ok: true; token: string | null; yaTeniaCuenta: boolean }
  | { ok: false; error: string };
export type LinkResultado = { ok: true; token: string } | { ok: false; error: string };
export type UsuarioAccionResultado = { ok: true } | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("usuarios_email_lower_unique") || texto.includes("usuarios_email_unique")) {
    return "Ya existe un usuario con ese email.";
  }
  if (texto.includes("usuario_empresa_usuario_empresa_unique")) return "Cada empresa solo puede asignarse una vez.";
  // Los errores crudos de la base no le sirven a quien usa la pantalla.
  if (error.message.startsWith("Failed query")) return "No se pudo completar la operación. Inténtalo de nuevo.";
  return error.message;
}

const actorDe = (session: Awaited<ReturnType<typeof requireAdminFirma>>): ActorGestion => ({
  id: session.user.id,
  nombre: session.user.name ?? "—",
  esSuperAdmin: session.user.esSuperAdmin,
});

const idValido = (id: string) => uuid.safeParse(id).success;
const recargar = () => revalidatePath("/admin/usuarios");

export async function invitarUsuarioAction(
  input: InvitarUsuarioInput,
): Promise<InvitarUsuarioResultado> {
  const session = await requireAdminFirma();

  const parsed = invitarUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const { token, yaTeniaCuenta } = await crearUsuarioInvitado(session.user.firmaContableId, parsed.data, actorDe(session));
    recargar();
    return { ok: true, token, yaTeniaCuenta };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Link nuevo para que una persona activa defina su contraseña de nuevo (cuenta ya activa). */
export async function resetearPasswordAction(usuarioId: string): Promise<LinkResultado> {
  const session = await requireAdminFirma();
  if (!idValido(usuarioId)) return { ok: false, error: "Usuario inválido." };

  try {
    const token = await generarTokenReset(usuarioId, session.user.firmaContableId, actorDe(session));
    return { ok: true, token };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Link de invitación nuevo para quien aún no activa su cuenta (el anterior deja de valer). */
export async function reenviarInvitacionAction(usuarioId: string): Promise<LinkResultado> {
  const session = await requireAdminFirma();
  if (!idValido(usuarioId)) return { ok: false, error: "Usuario inválido." };

  try {
    const token = await reenviarInvitacion(usuarioId, session.user.firmaContableId, actorDe(session));
    recargar();
    return { ok: true, token };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function cambiarEstadoUsuarioAction(
  usuarioId: string,
  accion: (typeof ACCION_ESTADO_USUARIO)[number],
  motivo?: string,
): Promise<UsuarioAccionResultado> {
  const session = await requireAdminFirma();
  if (!idValido(usuarioId) || !ACCION_ESTADO_USUARIO.includes(accion)) return { ok: false, error: "Solicitud inválida." };

  try {
    await cambiarEstadoUsuario(usuarioId, session.user.firmaContableId, accion, actorDe(session), motivo?.trim().slice(0, 500) || undefined);
    recargar();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarUsuarioAction(usuarioId: string, input: EditarUsuarioInput): Promise<UsuarioAccionResultado> {
  const session = await requireAdminFirma();
  if (!idValido(usuarioId)) return { ok: false, error: "Usuario inválido." };

  const parsed = editarUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await editarUsuario(usuarioId, session.user.firmaContableId, parsed.data, actorDe(session));
    recargar();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Historial de gestión de una cuenta; el primer argumento solo cumple la firma del diálogo de historial. */
export async function historialUsuarioAction(_empresaId: string, usuarioId: string): Promise<HistorialResultado> {
  const session = await requireAdminFirma();
  if (!idValido(usuarioId)) return { ok: false, error: "Usuario inválido." };

  try {
    const filas = await historialDeUsuario(usuarioId, session.user.firmaContableId, actorDe(session));
    return {
      ok: true,
      filas: filas.map((f) => ({
        id: f.id,
        creadoEn: f.creadoEn.toISOString(),
        usuarioNombre: f.usuarioNombre,
        accion: f.accion,
        motivo: f.motivo,
        valoresAnteriores: (f.valoresAnteriores as Record<string, unknown> | null) ?? null,
        valoresNuevos: (f.valoresNuevos as Record<string, unknown> | null) ?? null,
      })),
    };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
