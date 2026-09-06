"use server";

import { actualizarImpuesto, crearImpuesto, eliminarImpuesto } from "@erp/db";
import {
  crearImpuestoSchema,
  editarImpuestoSchema,
  type CrearImpuestoInput,
  type EditarImpuestoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type ImpuestoResultado = { ok: true; impuestoId: string } | { ok: false; error: string };
export type EliminarImpuestoResultado = { ok: true } | { ok: false; error: string };

const ROLES_CONFIG = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("impuestos_empresa_codigo_unique")) {
    return "Ya existe un impuesto con ese código en esta empresa.";
  }
  if (/foreign key|violates|still referenced/i.test(texto)) {
    return "No se puede eliminar: el impuesto está en uso.";
  }
  return error.message;
}

export async function crearImpuestoAction(
  empresaId: string,
  input: CrearImpuestoInput,
): Promise<ImpuestoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = crearImpuestoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const impuesto = await crearImpuesto(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/impuestos`);
    return { ok: true, impuestoId: impuesto.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarImpuestoAction(
  empresaId: string,
  impuestoId: string,
  input: EditarImpuestoInput,
): Promise<ImpuestoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = editarImpuestoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const impuesto = await actualizarImpuesto(impuestoId, empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/impuestos`);
    return { ok: true, impuestoId: impuesto.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarImpuestoAction(
  empresaId: string,
  impuestoId: string,
): Promise<EliminarImpuestoResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  try {
    await eliminarImpuesto(impuestoId, empresaId, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/impuestos`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
