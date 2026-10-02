"use server";

import {
  actualizarFechasDocumentoCompra,
  anularDocumentoCompra,
  cerrarPedidoCompra,
  contabilizarDocumentoCompra,
  descartarBorradorDocumentoCompra,
  crearYGuardarDocumentoCompra,
  guardarDocumentoCompraYFinalizar,
  listarAuditoriaDeRegistro,
  obtenerAsientoCompraContabilizado,
  obtenerDocumentoCompraConLineas,
  traerDesdeDocumento,
  vistaPreviaAsientoCompra,
} from "@erp/db";
import {
  anularDocumentoCompraSchema,
  guardarDocumentoCompraSchema,
  traerDesdeDocumentoSchema,
  type AnularDocumentoCompraInput,
  type GuardarDocumentoCompraInput,
  type TraerDesdeDocumentoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";
import type { AsientoVistaDTO, HistorialFila } from "@/lib/actions/ventas";

export type DocCompraResultado =
  | { ok: true; docId: string; contabilizado?: boolean; abierto?: boolean }
  | { ok: false; error: string };
export type DocCompraAccionResultado = { ok: true } | { ok: false; error: string };

const ROLES = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("documentos_compra_empresa_prov_tipo_folio_unique")) {
    return "Ya existe un documento de ese proveedor y tipo con ese folio.";
  }
  return error.message;
}

function rev(empresaId: string, docId?: string) {
  for (const slug of ["pedidos", "entradas", "facturas", "notas-credito", "notas-debito", "gr-ir"]) {
    revalidatePath(`/panel/${empresaId}/compras/${slug}`);
  }
  if (docId) revalidatePath(`/panel/${empresaId}/compras/documentos/${docId}`);
}

/** Las facturas de compra no tienen borrador: guardar siempre las contabiliza. */
const finalizaAlGuardar = (docTipo: string, finalizar?: boolean) => docTipo === "factura" || !!finalizar;

export async function guardarDocumentoCompraAction(
  empresaId: string,
  docId: string,
  input: GuardarDocumentoCompraInput,
  opciones: { finalizar?: boolean } = {},
): Promise<DocCompraResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = guardarDocumentoCompraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const detalle = await obtenerDocumentoCompraConLineas(docId, empresaId);
    if (!detalle) return { ok: false, error: "El documento no existe." };
    const r = await guardarDocumentoCompraYFinalizar(
      docId,
      empresaId,
      parsed.data,
      auditCtx(session),
      finalizaAlGuardar(detalle.documento.docTipo, opciones.finalizar),
    );
    rev(empresaId, docId);
    return { ok: true, docId, ...r };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Alta y guardado en un solo paso: el documento no existe hasta que se guarda con éxito. */
export async function crearYGuardarDocumentoCompraAction(
  empresaId: string,
  input: GuardarDocumentoCompraInput,
  opciones: { finalizar?: boolean } = {},
): Promise<DocCompraResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = guardarDocumentoCompraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const r = await crearYGuardarDocumentoCompra(
      empresaId,
      parsed.data,
      auditCtx(session),
      finalizaAlGuardar(parsed.data.docTipo, opciones.finalizar),
    );
    rev(empresaId, r.docId);
    return { ok: true, ...r };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

const fechaIso = /^\d{4}-\d{2}-\d{2}$/;

/** Vencimiento y contabilización: lo único editable de una factura ya contabilizada. */
export async function actualizarFechasDocumentoCompraAction(
  empresaId: string,
  docId: string,
  input: { fechaVencimiento: string; fechaContabilizacion: string },
): Promise<DocCompraAccionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  if (!fechaIso.test(input.fechaVencimiento) || !fechaIso.test(input.fechaContabilizacion)) {
    return { ok: false, error: "Indica fechas válidas." };
  }
  try {
    await actualizarFechasDocumentoCompra(docId, empresaId, input, auditCtx(session));
    rev(empresaId, docId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function cerrarPedidoCompraAction(
  empresaId: string,
  docId: string,
  forzar = false,
): Promise<DocCompraAccionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  try {
    await cerrarPedidoCompra(docId, empresaId, { forzar }, auditCtx(session));
    rev(empresaId, docId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function traerDesdeDocumentoAction(
  empresaId: string,
  input: TraerDesdeDocumentoInput,
): Promise<DocCompraResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = traerDesdeDocumentoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const doc = await traerDesdeDocumento(empresaId, parsed.data, auditCtx(session));
    rev(empresaId, doc.id);
    return { ok: true, docId: doc.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function reintentarFacturaCompraPendienteAction(
  empresaId: string,
  docId: string,
): Promise<DocCompraAccionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  try {
    await contabilizarDocumentoCompra(docId, empresaId, auditCtx(session));
    rev(empresaId, docId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function descartarDocumentoCompraPendienteAction(
  empresaId: string,
  docId: string,
): Promise<DocCompraAccionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  try {
    await descartarBorradorDocumentoCompra(
      docId,
      empresaId,
      "Documento de compra pendiente descartado por el usuario",
      auditCtx(session),
    );
    rev(empresaId, docId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function anularDocumentoCompraAction(
  empresaId: string,
  docId: string,
  input: AnularDocumentoCompraInput,
): Promise<DocCompraAccionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ["Administrador"]);
  const parsed = anularDocumentoCompraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await anularDocumentoCompra(
      docId,
      empresaId,
      parsed.data.motivo,
      parsed.data.fechaReversa,
      auditCtx(session),
    );
    rev(empresaId, docId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type VerAsientoCompraResultado =
  | { ok: true; data: AsientoVistaDTO }
  | { ok: false; error: string };

export async function verAsientoCompraAction(
  empresaId: string,
  docId: string,
): Promise<VerAsientoCompraResultado> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const detalle = await obtenerDocumentoCompraConLineas(docId, empresaId);
    if (!detalle) return { ok: false, error: "El documento no existe" };
    if (detalle.documento.asientoId) {
      const real = await obtenerAsientoCompraContabilizado(detalle.documento.asientoId, empresaId);
      if (real) return { ok: true, data: real };
    }
    const previa = await vistaPreviaAsientoCompra(empresaId, docId);
    return { ok: true, data: previa };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type HistorialCompraResultado =
  | { ok: true; filas: HistorialFila[] }
  | { ok: false; error: string };

export async function historialDocumentoCompraAction(
  empresaId: string,
  docId: string,
): Promise<HistorialCompraResultado> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const filas = await listarAuditoriaDeRegistro(empresaId, "documentos_compra", docId);
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
