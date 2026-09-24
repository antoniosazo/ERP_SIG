"use server";

import { actualizarFirmaContable, crearFirmaConAdmin } from "@erp/db";
import {
  actualizarFirmaContableSchema,
  crearFirmaConAdminSchema,
  type ActualizarFirmaContableInput,
  type CrearFirmaConAdminInput,
} from "@erp/shared";
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

export type CrearFirmaResultado = { ok: true; token: string } | { ok: false; error: string };

export async function crearFirmaConAdminAction(
  input: CrearFirmaConAdminInput,
): Promise<CrearFirmaResultado> {
  await requireSuperAdmin();

  const parsed = crearFirmaConAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const { token } = await crearFirmaConAdmin(parsed.data);
    revalidatePath("/superadmin/firmas");
    return { ok: true, token };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function actualizarFirmaContableAction(
  input: ActualizarFirmaContableInput,
): Promise<AccionResultado> {
  const session = await requireAdminFirma();

  const parsed = actualizarFirmaContableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await actualizarFirmaContable(session.user.firmaContableId, parsed.data);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }

  revalidatePath("/admin/firmas");
  return { ok: true };
}
