"use server";

import {
  anularDocumentoVenta,
  contabilizarDocumentoVenta,
  crearDocumentoVenta,
  crearNotaCreditoDesdeFactura,
  guardarDocumentoVenta,
  listarAuditoriaDeRegistro,
  obtenerAsientoVentaContabilizado,
  obtenerDocumentoVentaConLineas,
  vistaPreviaAsientoVenta,
} from "@erp/db";
import {
  anularDocumentoVentaSchema,
  crearDocumentoVentaSchema,
  emitirNotaCreditoSchema,
  guardarDocumentoVentaSchema,
  type AnularDocumentoVentaInput,
  type CrearDocumentoVentaInput,
  type GuardarDocumentoVentaInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type DocVentaResultado = { ok: true; docId: string } | { ok: false; error: string };
export type DocVentaAccionResultado = { ok: true } | { ok: false; error: string };

const ROLES = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("documentos_venta_empresa_tipo_folio_unique")) {
    return "Ya existe un documento de ese tipo con ese folio.";
  }
  return error.message;
}

function rev(empresaId: string, docId?: string) {
  for (const slug of ["facturas", "notas-credito", "notas-debito"]) {
    revalidatePath(`/panel/${empresaId}/ventas/${slug}`);
  }
  if (docId) revalidatePath(`/panel/${empresaId}/ventas/documentos/${docId}`);
}

export async function crearDocumentoVentaAction(
  empresaId: string,
  input: CrearDocumentoVentaInput,
): Promise<DocVentaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = crearDocumentoVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const doc = await crearDocumentoVenta(empresaId, parsed.data, auditCtx(session));
    rev(empresaId);
    return { ok: true, docId: doc.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function guardarDocumentoVentaAction(
  empresaId: string,
  docId: string,
  input: GuardarDocumentoVentaInput,
): Promise<DocVentaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = guardarDocumentoVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await guardarDocumentoVenta(docId, empresaId, parsed.data, auditCtx(session));
    rev(empresaId, docId);
    return { ok: true, docId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function contabilizarDocumentoVentaAction(
  empresaId: string,
  docId: string,
): Promise<DocVentaAccionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  try {
    await contabilizarDocumentoVenta(docId, empresaId, auditCtx(session));
    rev(empresaId, docId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function emitirNotaCreditoDesdeFacturaAction(
  empresaId: string,
  facturaId: string,
  tipoDocumentoId: string,
): Promise<DocVentaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = emitirNotaCreditoSchema.safeParse({ facturaId, tipoDocumentoId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const doc = await crearNotaCreditoDesdeFactura(
      empresaId,
      parsed.data.facturaId,
      parsed.data.tipoDocumentoId,
      auditCtx(session),
    );
    rev(empresaId, facturaId);
    return { ok: true, docId: doc.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type AsientoVistaLinea = {
  cuenta: string;
  centroCosto: string | null;
  glosa: string | null;
  debe: number;
  haber: number;
};
export type AsientoVistaDTO = {
  modo: "real" | "previa";
  correlativo?: number;
  fecha: string;
  glosa: string;
  lineas: AsientoVistaLinea[];
  totalDebe: number;
  totalHaber: number;
  cuadra: boolean;
  errores: string[];
};
export type VerAsientoResultado =
  | { ok: true; data: AsientoVistaDTO }
  | { ok: false; error: string };

/** Asiento real si el documento tiene uno; si no, vista previa calculada con validaciones. */
export async function verAsientoVentaAction(
  empresaId: string,
  docId: string,
): Promise<VerAsientoResultado> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const detalle = await obtenerDocumentoVentaConLineas(docId, empresaId);
    if (!detalle) return { ok: false, error: "El documento no existe" };
    if (detalle.documento.asientoId) {
      const real = await obtenerAsientoVentaContabilizado(detalle.documento.asientoId, empresaId);
      if (real) return { ok: true, data: real };
    }
    const previa = await vistaPreviaAsientoVenta(empresaId, docId);
    return { ok: true, data: previa };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type HistorialFila = {
  id: string;
  creadoEn: string;
  usuarioNombre: string;
  accion: string;
  motivo: string | null;
  valoresAnteriores: Record<string, unknown> | null;
  valoresNuevos: Record<string, unknown> | null;
};
export type HistorialResultado =
  | { ok: true; filas: HistorialFila[] }
  | { ok: false; error: string };

/** Bitácora de modificaciones de este documento de venta. */
export async function historialDocumentoVentaAction(
  empresaId: string,
  docId: string,
): Promise<HistorialResultado> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const filas = await listarAuditoriaDeRegistro(empresaId, "documentos_venta", docId);
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

export async function anularDocumentoVentaAction(
  empresaId: string,
  docId: string,
  input: AnularDocumentoVentaInput,
): Promise<DocVentaAccionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ["Administrador"]);
  const parsed = anularDocumentoVentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await anularDocumentoVenta(docId, empresaId, parsed.data.motivo, auditCtx(session));
    rev(empresaId, docId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
