"use server";

import { actualizarCategoria, crearCategoria } from "@erp/db";
import {
  crearCategoriaSchema,
  editarCategoriaSchema,
  type CrearCategoriaInput,
  type EditarCategoriaInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type CategoriaResultado =
  | { ok: true; categoriaId: string }
  | { ok: false; error: string };

const ROLES_CONFIG = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("categorias_contables_empresa_nombre_unique")) {
      return "Ya existe una categoría contable con ese nombre en esta empresa.";
    }
    return error.message;
  }
  return "Error desconocido";
}

export async function crearCategoriaAction(
  empresaId: string,
  input: CrearCategoriaInput,
): Promise<CategoriaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = crearCategoriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const categoria = await crearCategoria(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/categorias`);
    return { ok: true, categoriaId: categoria.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarCategoriaAction(
  empresaId: string,
  categoriaId: string,
  input: EditarCategoriaInput,
): Promise<CategoriaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = editarCategoriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const categoria = await actualizarCategoria(categoriaId, empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/categorias`);
    return { ok: true, categoriaId: categoria.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
