"use server";

import { guardarFormatoCartola, listarFormatosCartola } from "@erp/db";
import { guardarFormatoCartolaSchema, type GuardarFormatoCartolaInput } from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

const ROLES = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

export async function guardarFormatoCartolaAction(
  empresaId: string,
  input: GuardarFormatoCartolaInput,
): Promise<{ ok: true; formatoId: string } | { ok: false; error: string }> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = guardarFormatoCartolaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const formato = await guardarFormatoCartola(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/cartolas-formatos`);
    return { ok: true, formatoId: formato.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function listarFormatosCartolaAction(empresaId: string) {
  await requireRolEnEmpresa(empresaId, ROLES);
  return listarFormatosCartola(empresaId);
}
