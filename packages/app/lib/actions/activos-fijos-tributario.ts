"use server";

import {
  aplicarCorreccionMonetaria,
  calcularDDAN,
  crearVidaUtilSii,
  guardarFactorCorreccionMonetaria,
  type FilaCorreccionMonetaria,
  type ResultadoDdan,
} from "@erp/db";
import {
  aplicarCorreccionMonetariaSchema,
  crearVidaUtilSiiSchema,
  guardarFactorCorreccionMonetariaSchema,
  type AplicarCorreccionMonetariaInput,
  type CrearVidaUtilSiiInput,
  type GuardarFactorCorreccionMonetariaInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

const ROLES = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

export async function crearVidaUtilSiiAction(
  empresaId: string,
  input: CrearVidaUtilSiiInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = crearVidaUtilSiiSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const fila = await crearVidaUtilSii(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/activos-fijos/vidas-utiles`);
    return { ok: true, id: fila.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function guardarFactorCorreccionMonetariaAction(
  empresaId: string,
  input: GuardarFactorCorreccionMonetariaInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = guardarFactorCorreccionMonetariaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await guardarFactorCorreccionMonetaria(parsed.data);
    revalidatePath(`/panel/${empresaId}/activos-fijos/correccion-monetaria`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type AplicarCorreccionMonetariaResultado =
  | { ok: true; modo: "simulacion"; anio: number; filas: FilaCorreccionMonetaria[]; totalAjusteCosto: number; totalAjusteDepAcumulada: number }
  | { ok: true; modo: "real"; documentoId: string; totalAjusteCosto: number; activos: number }
  | { ok: false; error: string };

export async function aplicarCorreccionMonetariaAction(
  empresaId: string,
  input: AplicarCorreccionMonetariaInput,
): Promise<AplicarCorreccionMonetariaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = aplicarCorreccionMonetariaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const resultado = await aplicarCorreccionMonetaria(empresaId, parsed.data, auditCtx(session));
    if (parsed.data.modo === "simulacion") {
      return {
        ok: true,
        modo: "simulacion",
        anio: resultado.anio,
        filas: resultado.filas,
        totalAjusteCosto: resultado.totalAjusteCosto,
        totalAjusteDepAcumulada: resultado.totalAjusteDepAcumulada,
      };
    }
    revalidatePath(`/panel/${empresaId}/activos-fijos/correccion-monetaria`);
    revalidatePath(`/panel/${empresaId}/informes/activos-fijos`);
    return {
      ok: true,
      modo: "real",
      documentoId: resultado.documentoId ?? "",
      totalAjusteCosto: resultado.totalAjusteCosto,
      activos: resultado.filas.length,
    };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function calcularDdanAction(
  empresaId: string,
  activoId: string,
  anio: number,
): Promise<{ ok: true; resultado: ResultadoDdan } | { ok: false; error: string }> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const resultado = await calcularDDAN(empresaId, activoId, anio);
    return { ok: true, resultado };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
