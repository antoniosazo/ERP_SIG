"use server";

import { guardarReglaDeterminacion } from "@erp/db";
import {
  guardarReglaDeterminacionSchema,
  type GuardarReglaDeterminacionInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type ReglaResultado = { ok: true } | { ok: false; error: string };

const ROLES = ["Administrador", "Contador"];

export async function guardarReglaDeterminacionAction(
  empresaId: string,
  input: GuardarReglaDeterminacionInput,
): Promise<ReglaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = guardarReglaDeterminacionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await guardarReglaDeterminacion(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/determinacion-cuentas`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}
