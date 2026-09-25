"use server";

import { createHash } from "node:crypto";
import {
  agregarMovimientoManual,
  confirmarImportacionCartola,
  listarCartolas,
  obtenerCartolaConMovimientos,
  obtenerFormatoCartola,
  previsualizarCartola,
  type PreviaCartola,
} from "@erp/db";
import {
  agregarMovimientoManualSchema,
  confirmarImportacionCartolaSchema,
  previsualizarCartolaSchema,
  type AgregarMovimientoManualInput,
  type ConfirmarImportacionCartolaInput,
  type FilaCartolaMapeada,
  type PrevisualizarCartolaInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";
import { extraerFilasCrudas } from "@/lib/cartolas-parser";
import { mapearFila } from "@/lib/cartolas-mapeo";

const ROLES = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

function revalidar(empresaId: string) {
  revalidatePath(`/panel/${empresaId}/tesoreria/cartolas`);
}

function base64ABytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export type PrevisualizarCartolaResultado =
  | { ok: true; previa: PreviaCartola; archivoHash: string; fechaDesde: string; fechaHasta: string }
  | { ok: false; error: string };

/** Decodifica y parsea el archivo server-side, mapea sus filas con la plantilla elegida
 * y corre las validaciones de 5.4 — todo de solo lectura, sin persistir nada. */
export async function previsualizarCartolaAction(
  empresaId: string,
  input: PrevisualizarCartolaInput,
): Promise<PrevisualizarCartolaResultado> {
  await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = previsualizarCartolaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const formato = await obtenerFormatoCartola(parsed.data.formatoId, empresaId);
    if (!formato) return { ok: false, error: "La plantilla de cartola no existe" };

    const bytes = base64ABytes(parsed.data.archivoBase64);
    const archivoHash = createHash("sha256").update(bytes).digest("hex");
    const filasCrudas = extraerFilasCrudas(
      formato.tipoArchivo,
      formato.codificacion,
      formato.separador,
      formato.filasOmitirInicio,
      formato.filasOmitirFin,
      bytes,
    );
    const filas: FilaCartolaMapeada[] = [];
    for (const fila of filasCrudas) {
      const mapeada = mapearFila(formato.tipoArchivo, formato.campos, formato.formatoFecha, formato.formatoNumero, formato.reglaSigno, fila);
      if (mapeada) filas.push(mapeada);
    }
    if (filas.length === 0) return { ok: false, error: "El archivo no tiene movimientos reconocibles con esta plantilla" };

    const previa = await previsualizarCartola(empresaId, parsed.data.cuentaBancariaId, filas, parsed.data.saldoInicial, parsed.data.saldoFinal);
    const fechas = filas.map((f) => f.fecha).sort();
    return { ok: true, previa, archivoHash, fechaDesde: fechas[0]!, fechaHasta: fechas[fechas.length - 1]! };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type ConfirmarImportacionResultado = { ok: true; cartolaId: string; insertadas: number } | { ok: false; error: string };

/** Recibe las filas ya devueltas por la previa (no vuelve a subir ni a parsear el archivo). */
export async function confirmarImportacionCartolaAction(
  empresaId: string,
  cuentaBancariaId: string,
  input: ConfirmarImportacionCartolaInput,
): Promise<ConfirmarImportacionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = confirmarImportacionCartolaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const { cartola, insertadas } = await confirmarImportacionCartola(empresaId, cuentaBancariaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, cartolaId: cartola.id, insertadas };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function agregarMovimientoManualAction(
  empresaId: string,
  cuentaBancariaId: string,
  input: AgregarMovimientoManualInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = agregarMovimientoManualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await agregarMovimientoManual(
      empresaId,
      cuentaBancariaId,
      {
        fecha: parsed.data.fecha,
        descripcion: parsed.data.descripcion,
        nroDocumento: parsed.data.nroDocumento ?? null,
        rutContraparte: parsed.data.rutContraparte ?? null,
        monto: parsed.data.monto,
        codigoTransaccion: null,
      },
      auditCtx(session),
    );
    revalidar(empresaId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function listarCartolasAction(empresaId: string, cuentaBancariaId?: string) {
  await requireRolEnEmpresa(empresaId, ROLES);
  return listarCartolas(empresaId, cuentaBancariaId);
}

export async function obtenerCartolaAction(empresaId: string, cartolaId: string) {
  await requireRolEnEmpresa(empresaId, ROLES);
  return obtenerCartolaConMovimientos(cartolaId, empresaId);
}
