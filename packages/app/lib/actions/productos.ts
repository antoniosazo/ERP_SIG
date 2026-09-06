"use server";

import { actualizarProducto, crearProducto } from "@erp/db";
import {
  crearProductoSchema,
  editarProductoSchema,
  type CrearProductoInput,
  type EditarProductoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type ProductoResultado = { ok: true; productoId: string } | { ok: false; error: string };

const ROLES = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("productos_empresa_codigo_unique")) {
    return "Ya existe un producto con ese código en esta empresa.";
  }
  return error.message;
}

function rev(empresaId: string) {
  revalidatePath(`/panel/${empresaId}/inventario/productos`);
}

export async function crearProductoAction(
  empresaId: string,
  input: CrearProductoInput,
): Promise<ProductoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = crearProductoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const prod = await crearProducto(empresaId, parsed.data, auditCtx(session));
    rev(empresaId);
    return { ok: true, productoId: prod.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarProductoAction(
  empresaId: string,
  productoId: string,
  input: EditarProductoInput,
): Promise<ProductoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = editarProductoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const prod = await actualizarProducto(productoId, empresaId, parsed.data, auditCtx(session));
    rev(empresaId);
    return { ok: true, productoId: prod.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
