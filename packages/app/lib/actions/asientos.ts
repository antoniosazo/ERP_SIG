"use server";

import {
  anularAsientoManual,
  eliminarBorradorAsiento,
  ejecutarReversionesPendientes,
  guardarAsientoManual,
  listarAuditoriaDeAsiento,
} from "@erp/db";
import { ROLES_FINANZAS, uuid, anularAsientoSchema, asientoManualSchema, type AnularAsientoInput, type AsientoManualInput } from "@erp/shared";
import { revalidatePath } from "next/cache";
import type { HistorialResultado } from "@/lib/actions/ventas";
import { auditCtx, obtenerAccesoEmpresa, requireRolEnEmpresa } from "@/lib/auth-helpers";

const ROLES = ROLES_FINANZAS;

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

/** Un asiento manual mueve saldos de cuentas, socios e informes. */
function revalidar(empresaId: string) {
  revalidatePath(`/panel/${empresaId}/contabilidad/asientos`, "layout");
  revalidatePath(`/panel/${empresaId}/informes`, "layout");
  revalidatePath(`/panel/${empresaId}/configuracion/plan-cuentas`, "layout");
  revalidatePath(`/panel/${empresaId}/maestros/terceros`, "layout");
}

export type AsientoResultado = { ok: true; asientoId: string; correlativo: number | null } | { ok: false; error: string };

/** Crea un asiento manual (o actualiza un borrador); con `contabilizar` queda definitivo. */
export async function guardarAsientoManualAction(
  empresaId: string,
  asientoId: string | null,
  input: AsientoManualInput,
): Promise<AsientoResultado> {
  const parsed = asientoManualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const session = await requireRolEnEmpresa(empresaId, ROLES);
    if (asientoId !== null) uuid.parse(asientoId);
    const r = await guardarAsientoManual(empresaId, parsed.data, asientoId, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, asientoId: r.id, correlativo: r.correlativo };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarBorradorAsientoAction(
  empresaId: string,
  asientoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireRolEnEmpresa(empresaId, ROLES);
    uuid.parse(asientoId);
    await eliminarBorradorAsiento(empresaId, asientoId, auditCtx(session));
    revalidar(empresaId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Anula un asiento manual contabilizado creando su reversa. */
export async function anularAsientoAction(
  empresaId: string,
  asientoId: string,
  input: AnularAsientoInput,
): Promise<AsientoResultado> {
  const parsed = anularAsientoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const session = await requireRolEnEmpresa(empresaId, ROLES);
    uuid.parse(asientoId);
    const reversa = await anularAsientoManual(empresaId, asientoId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, asientoId: reversa.id, correlativo: reversa.correlativo };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Ejecuta las reversiones programadas cuya fecha ya llegó. */
export async function ejecutarReversionesAction(
  empresaId: string,
): Promise<{ ok: true; hechas: number; errores: string[] } | { ok: false; error: string }> {
  try {
    const session = await requireRolEnEmpresa(empresaId, ROLES);
    const hoy = new Date().toISOString().slice(0, 10);
    const r = await ejecutarReversionesPendientes(empresaId, hoy, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, hechas: r.hechas.length, errores: r.errores };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Bitácora de modificaciones del asiento. */
export async function historialAsientoAction(empresaId: string, registroId: string): Promise<HistorialResultado> {
  try {
    if (!await obtenerAccesoEmpresa(empresaId)) throw new Error("No tienes acceso a esta empresa");
    uuid.parse(registroId);
    const filas = await listarAuditoriaDeAsiento(empresaId, registroId);
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
