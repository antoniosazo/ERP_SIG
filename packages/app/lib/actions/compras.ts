"use server";

import {
  abrirPedidoCompra,
  anularDocumentoCompra,
  cerrarPedidoCompra,
  contabilizarDocumentoCompra,
  crearDocumentoCompra,
  guardarDocumentoCompra,
  listarAuditoriaDeRegistro,
  obtenerAsientoCompraContabilizado,
  obtenerDocumentoCompraConLineas,
  traerDesdeDocumento,
  vistaPreviaAsientoCompra,
} from "@erp/db";
import {
  anularDocumentoCompraSchema,
  crearDocumentoCompraSchema,
  guardarDocumentoCompraSchema,
  traerDesdeDocumentoSchema,
  type AnularDocumentoCompraInput,
  type CrearDocumentoCompraInput,
  type GuardarDocumentoCompraInput,
  type TraerDesdeDocumentoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";
import type { AsientoVistaDTO, HistorialFila } from "@/lib/actions/ventas";

export type DocCompraResultado = { ok: true; docId: string } | { ok: false; error: string };
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
  for (const slug of ["pedidos", "facturas", "notas-credito", "notas-debito"]) {
    revalidatePath(`/panel/${empresaId}/compras/${slug}`);
  }
  if (docId) revalidatePath(`/panel/${empresaId}/compras/documentos/${docId}`);
}

export async function crearDocumentoCompraAction(
  empresaId: string,
  input: CrearDocumentoCompraInput,
): Promise<DocCompraResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = crearDocumentoCompraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const doc = await crearDocumentoCompra(empresaId, parsed.data, auditCtx(session));
    rev(empresaId);
    return { ok: true, docId: doc.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function guardarDocumentoCompraAction(
  empresaId: string,
  docId: string,
  input: GuardarDocumentoCompraInput,
): Promise<DocCompraResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = guardarDocumentoCompraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await guardarDocumentoCompra(docId, empresaId, parsed.data, auditCtx(session));
    rev(empresaId, docId);
    return { ok: true, docId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function abrirPedidoCompraAction(
  empresaId: string,
  docId: string,
): Promise<DocCompraAccionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  try {
    await abrirPedidoCompra(docId, empresaId, auditCtx(session));
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

export async function contabilizarDocumentoCompraAction(
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
    await anularDocumentoCompra(docId, empresaId, parsed.data.motivo, auditCtx(session));
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
