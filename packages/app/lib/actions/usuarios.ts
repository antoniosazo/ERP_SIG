"use server";

import { crearUsuarioInvitado, generarTokenReset } from "@erp/db";
import { invitarUsuarioSchema, type InvitarUsuarioInput } from "@erp/shared";
import { revalidatePath } from "next/cache";
import { requireAdminFirma } from "@/lib/auth-helpers";

export type InvitarUsuarioResultado =
  | { ok: true; token: string }
  | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("usuarios_email_unique")) {
      return "Ya existe un usuario con ese email.";
    }
    return error.message;
  }
  return "Error desconocido";
}

export async function invitarUsuarioAction(
  input: InvitarUsuarioInput,
): Promise<InvitarUsuarioResultado> {
  const session = await requireAdminFirma();

  const parsed = invitarUsuarioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const { token } = await crearUsuarioInvitado(session.user.firmaContableId, parsed.data);
    revalidatePath("/admin/usuarios");
    return { ok: true, token };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function resetearPasswordAction(
  usuarioId: string,
): Promise<InvitarUsuarioResultado> {
  await requireAdminFirma();

  try {
    const token = await generarTokenReset(usuarioId);
    return { ok: true, token };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
