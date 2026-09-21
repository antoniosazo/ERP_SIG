"use server";

import { anularPago, listarAuditoriaDeRegistro, listarDocumentosAbiertos, registrarPago, type DocumentoAbierto } from "@erp/db";
import {
  anularPagoSchema,
  registrarPagoSchema,
  type AnularPagoInput,
  type PagoTipo,
  type RegistrarPagoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import type { HistorialResultado } from "@/lib/actions/ventas";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";
import { PAGO_META } from "@/lib/pagos";

const ROLES = ["Administrador", "Contador"];

export type PagoResultado = { ok: true; pagoId: string } | { ok: false; error: string };

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}


function revalidar(empresaId: string) {
  for (const m of Object.values(PAGO_META)) revalidatePath(`/panel/${empresaId}/tesoreria/${m.slug}`);
  for (const slug of ["facturas", "notas-debito"]) {
    revalidatePath(`/panel/${empresaId}/compras/${slug}`);
    revalidatePath(`/panel/${empresaId}/ventas/${slug}`);
  }
}

/** Facturas y notas de débito con saldo del tercero (ventas para cobros, compras para pagos). */
export async function documentosAbiertosAction(
  empresaId: string,
  tipo: PagoTipo,
  terceroId: string,
): Promise<{ ok: true; documentos: DocumentoAbierto[] } | { ok: false; error: string }> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    return { ok: true, documentos: await listarDocumentosAbiertos(empresaId, tipo, terceroId) };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Registra el pago y lo contabiliza en el mismo paso. */
export async function registrarPagoAction(
  empresaId: string,
  input: RegistrarPagoInput,
): Promise<PagoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = registrarPagoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const { pago } = await registrarPago(empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, pagoId: pago.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function anularPagoAction(
  empresaId: string,
  pagoId: string,
  input: AnularPagoInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = anularPagoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await anularPago(pagoId, empresaId, parsed.data.motivo, auditCtx(session));
    revalidar(empresaId);
    revalidatePath(`/panel/${empresaId}/tesoreria`, "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Bitácora de modificaciones de este registro de tesorería. */
export async function historialPagoAction(empresaId: string, registroId: string): Promise<HistorialResultado> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const filas = await listarAuditoriaDeRegistro(empresaId, "pagos", registroId);
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
