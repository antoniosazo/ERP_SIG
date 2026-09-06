"use server";

import {
  actualizarGrupoTercero,
  crearGrupoTercero,
  eliminarGrupoTercero,
} from "@erp/db";
import {
  crearGrupoTerceroSchema,
  editarGrupoTerceroSchema,
  type CrearGrupoTerceroInput,
  type EditarGrupoTerceroInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type GrupoTerceroResultado = { ok: true; grupoId: string } | { ok: false; error: string };
export type EliminarGrupoTerceroResultado = { ok: true } | { ok: false; error: string };

const ROLES_CONFIG = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("terceros_grupos_empresa_codigo_unique")) {
    return "Ya existe un grupo con ese código en esta empresa.";
  }
  if (/foreign key|violates|still referenced/i.test(texto)) {
    return "No se puede eliminar: el grupo está asignado a socios.";
  }
  return error.message;
}

export async function crearGrupoTerceroAction(
  empresaId: string,
  input: CrearGrupoTerceroInput,
): Promise<GrupoTerceroResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = crearGrupoTerceroSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const grupo = await crearGrupoTercero(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/maestros/grupos-terceros`);
    return { ok: true, grupoId: grupo.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarGrupoTerceroAction(
  empresaId: string,
  grupoId: string,
  input: EditarGrupoTerceroInput,
): Promise<GrupoTerceroResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = editarGrupoTerceroSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    const grupo = await actualizarGrupoTercero(grupoId, empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/maestros/grupos-terceros`);
    return { ok: true, grupoId: grupo.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarGrupoTerceroAction(
  empresaId: string,
  grupoId: string,
): Promise<EliminarGrupoTerceroResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  try {
    await eliminarGrupoTercero(grupoId, empresaId, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/maestros/grupos-terceros`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
