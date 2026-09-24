"use server";

import { actualizarCentroCosto, crearCentroCosto } from "@erp/db";
import {
  crearCentroCostoSchema,
  editarCentroCostoSchema,
  type CrearCentroCostoInput,
  type EditarCentroCostoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type CentroCostoResultado =
  | { ok: true; centroCostoId: string }
  | { ok: false; error: string };

const ROLES_CONFIG = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("centros_costo_empresa_codigo_unique")) {
    return "Ya existe un centro de costo con ese código en esta empresa.";
  }
  return error.message;
}

export async function crearCentroCostoAction(
  empresaId: string,
  input: CrearCentroCostoInput,
): Promise<CentroCostoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = crearCentroCostoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const centro = await crearCentroCosto(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/centros-costo`);
    return { ok: true, centroCostoId: centro.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarCentroCostoAction(
  empresaId: string,
  centroCostoId: string,
  input: EditarCentroCostoInput,
): Promise<CentroCostoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = editarCentroCostoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const centro = await actualizarCentroCosto(centroCostoId, empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/centros-costo`);
    return { ok: true, centroCostoId: centro.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
