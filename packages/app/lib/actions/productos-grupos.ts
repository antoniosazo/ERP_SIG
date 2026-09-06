"use server";

import { actualizarProductoGrupo, crearProductoGrupo } from "@erp/db";
import {
  crearProductoGrupoSchema,
  editarProductoGrupoSchema,
  type CrearProductoGrupoInput,
  type EditarProductoGrupoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type ProductoGrupoResultado =
  | { ok: true; grupoId: string }
  | { ok: false; error: string };

const ROLES = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("productos_grupos_empresa_nombre_unique")) {
    return "Ya existe un grupo de productos con ese nombre en esta empresa.";
  }
  return error.message;
}

function rev(empresaId: string) {
  revalidatePath(`/panel/${empresaId}/inventario/grupos-productos`);
  revalidatePath(`/panel/${empresaId}/inventario/productos`);
}

export async function crearProductoGrupoAction(
  empresaId: string,
  input: CrearProductoGrupoInput,
): Promise<ProductoGrupoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = crearProductoGrupoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const grupo = await crearProductoGrupo(empresaId, parsed.data, auditCtx(session));
    rev(empresaId);
    return { ok: true, grupoId: grupo.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarProductoGrupoAction(
  empresaId: string,
  grupoId: string,
  input: EditarProductoGrupoInput,
): Promise<ProductoGrupoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = editarProductoGrupoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const grupo = await actualizarProductoGrupo(grupoId, empresaId, parsed.data, auditCtx(session));
    rev(empresaId);
    return { ok: true, grupoId: grupo.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
