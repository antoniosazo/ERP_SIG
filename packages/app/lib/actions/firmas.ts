"use server";

import { actualizarFirmaContable } from "@erp/db";
import { actualizarFirmaContableSchema, type ActualizarFirmaContableInput } from "@erp/shared";
import { revalidatePath } from "next/cache";
import { requireAdminFirma } from "@/lib/auth-helpers";

export type AccionResultado = { ok: true } | { ok: false; error: string };

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
