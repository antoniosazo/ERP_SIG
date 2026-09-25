"use server";

import { cerrarEjercicioActivoFijo, reabrirEjercicioActivoFijo } from "@erp/db";
import {
  cerrarEjercicioActivoFijoSchema,
  reabrirEjercicioActivoFijoSchema,
  type CerrarEjercicioActivoFijoInput,
  type ReabrirEjercicioActivoFijoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

const ROLES = ["Administrador", "Contador"];

type Resultado = { ok: true } | { ok: false; error: string };

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

function revalidar(empresaId: string) {
  revalidatePath(`/panel/${empresaId}/activos-fijos/cierre`);
  revalidatePath(`/panel/${empresaId}/informes/activos-fijos`);
}

export async function cerrarEjercicioActivoFijoAction(
  empresaId: string,
  input: CerrarEjercicioActivoFijoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = cerrarEjercicioActivoFijoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await cerrarEjercicioActivoFijo(empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function reabrirEjercicioActivoFijoAction(
  empresaId: string,
  input: ReabrirEjercicioActivoFijoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = reabrirEjercicioActivoFijoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await reabrirEjercicioActivoFijo(empresaId, parsed.data.libro, parsed.data.anio, parsed.data.motivo, auditCtx(session));
    revalidar(empresaId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
