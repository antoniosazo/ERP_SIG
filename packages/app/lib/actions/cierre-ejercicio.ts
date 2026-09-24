"use server";

import { cerrarEjercicio, reabrirEjercicio } from "@erp/db";
import {
  cerrarEjercicioSchema,
  reabrirEjercicioSchema,
  type CerrarEjercicioInput,
  type ReabrirEjercicioInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

const ROLES = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

function revalidar(empresaId: string, anio: number) {
  revalidatePath(`/panel/${empresaId}/configuracion/cierre-ejercicio`);
  revalidatePath(`/panel/${empresaId}/informes/balance`);
  revalidatePath(`/panel/${empresaId}/informes/estado-resultados`);
  revalidatePath(`/panel/${empresaId}/configuracion/plan-cuentas`);
}

export async function cerrarEjercicioAction(
  empresaId: string,
  input: CerrarEjercicioInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRolEnEmpresa(empresaId, ["Administrador"]);
  const parsed = cerrarEjercicioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await cerrarEjercicio(empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId, parsed.data.anio);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function reabrirEjercicioAction(
  empresaId: string,
  input: ReabrirEjercicioInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRolEnEmpresa(empresaId, ["Administrador"]);
  const parsed = reabrirEjercicioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await reabrirEjercicio(empresaId, parsed.data.anio, parsed.data.motivo, auditCtx(session));
    revalidar(empresaId, parsed.data.anio);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
