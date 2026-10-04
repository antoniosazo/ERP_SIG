"use server";

import { actualizarFirmaContable, actualizarPerfilFirma, crearFirmaConAdmin, reintentarBaseFirma } from "@erp/db";
import {
  actualizarFirmaContableSchema,
  actualizarPerfilFirmaSchema,
  crearFirmaConAdminSchema,
  type ActualizarFirmaContableInput,
  type ActualizarPerfilFirmaInput,
  type CrearFirmaConAdminInput,
} from "@erp/shared";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminFirma, requireSuperAdmin } from "@/lib/auth-helpers";

export type AccionResultado = { ok: true } | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  // El detalle real de Postgres (nombre de constraint incluido) llega en `error.cause`,
  // no en `error.message` (que solo trae la query fallida) — hay que mirar ambos.
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("firmas_contables_rut_unique")) {
    return "Ya existe una firma con ese RUT.";
  }
  if (texto.includes("usuarios_email_unique")) {
    return "Ya existe un usuario con ese email.";
  }
  return error.message;
}

/** `token` es null cuando el administrador ya tenía cuenta: entra con su misma contraseña y no hay link. */
export type CrearFirmaResultado = { ok: true; token: string | null; yaTeniaCuenta: boolean } | { ok: false; error: string };

export async function crearFirmaConAdminAction(
  input: CrearFirmaConAdminInput,
): Promise<CrearFirmaResultado> {
  await requireSuperAdmin();

  const parsed = crearFirmaConAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const { token, yaTeniaCuenta } = await crearFirmaConAdmin(parsed.data);
    revalidatePath("/superadmin/firmas");
    return { ok: true, token, yaTeniaCuenta };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type ReintentarBaseResultado =
  | { ok: true; invitaciones: { email: string; token: string }[] }
  | { ok: false; error: string };

/** Termina el alta de una firma cuya base quedó en error (sin crear un segundo proyecto). */
export async function reintentarBaseFirmaAction(firmaId: string): Promise<ReintentarBaseResultado> {
  await requireSuperAdmin();
  try {
    const invitaciones = await reintentarBaseFirma(firmaId);
    revalidatePath("/superadmin/firmas");
    return { ok: true, invitaciones };
  } catch (error) {
    revalidatePath("/superadmin/firmas");
    return { ok: false, error: mensajeError(error) };
  }
}

export async function actualizarFirmaContableAction(
  input: ActualizarPerfilFirmaInput,
): Promise<AccionResultado> {
  const session = await requireAdminFirma();

  const parsed = actualizarPerfilFirmaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await actualizarPerfilFirma(session.user.firmaContableId, parsed.data.razonSocial);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }

  revalidatePath("/admin/firmas");
  return { ok: true };
}

/** Permite al superadmin editar una firma elegida desde el listado global. */
export async function actualizarFirmaSuperAdminAction(
  firmaId: string,
  input: ActualizarFirmaContableInput,
): Promise<AccionResultado> {
  await requireSuperAdmin();

  if (!z.uuid().safeParse(firmaId).success) {
    return { ok: false, error: "Identificador de firma inválido" };
  }
  const parsed = actualizarFirmaContableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await actualizarFirmaContable(firmaId, parsed.data);
    revalidatePath("/superadmin/firmas");
    revalidatePath("/admin/firmas");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
