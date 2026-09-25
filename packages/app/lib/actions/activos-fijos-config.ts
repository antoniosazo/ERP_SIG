"use server";

import { actualizarClaseActivoFijo, crearClaseActivoFijo, guardarCuentasClase } from "@erp/db";
import {
  crearClaseActivoFijoSchema,
  editarClaseActivoFijoSchema,
  guardarCuentasClaseSchema,
  type CrearClaseActivoFijoInput,
  type EditarClaseActivoFijoInput,
  type GuardarCuentasClaseInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

const ROLES_CONFIG = ["Administrador", "Contador"];

type Resultado = { ok: true; id: string } | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("activos_fijos_clases_empresa_codigo_unique")) {
    return "Ya existe una clase de activo con ese código en esta empresa.";
  }
  return error.message;
}

function revalidar(empresaId: string) {
  revalidatePath(`/panel/${empresaId}/activos-fijos/clases`);
}

export async function crearClaseActivoFijoAction(
  empresaId: string,
  input: CrearClaseActivoFijoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = crearClaseActivoFijoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const clase = await crearClaseActivoFijo(empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, id: clase.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarClaseActivoFijoAction(
  empresaId: string,
  claseId: string,
  input: EditarClaseActivoFijoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = editarClaseActivoFijoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const clase = await actualizarClaseActivoFijo(claseId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, id: clase.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function guardarCuentasClaseAction(
  empresaId: string,
  claseId: string,
  input: GuardarCuentasClaseInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = guardarCuentasClaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await guardarCuentasClase(claseId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, id: claseId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
