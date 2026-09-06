"use server";

import { actualizarMoneda, crearMoneda, eliminarMoneda } from "@erp/db";
import {
  crearMonedaSchema,
  editarMonedaSchema,
  type CrearMonedaInput,
  type EditarMonedaInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type MonedaResultado = { ok: true; monedaId: string } | { ok: false; error: string };
export type EliminarMonedaResultado = { ok: true } | { ok: false; error: string };

const ROLES_CONFIG = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  // El detalle real de Postgres (violación de FK / unique) suele venir en error.cause.
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("monedas_empresa_codigo_unique")) {
    return "Ya existe una moneda con ese código en esta empresa.";
  }
  if (/foreign key|violates|still referenced/i.test(texto)) {
    return "No se puede eliminar: la moneda está en uso por la empresa o por asientos.";
  }
  return error.message;
}

export async function crearMonedaAction(
  empresaId: string,
  input: CrearMonedaInput,
): Promise<MonedaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = crearMonedaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const moneda = await crearMoneda(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/monedas`);
    return { ok: true, monedaId: moneda.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarMonedaAction(
  empresaId: string,
  monedaId: string,
  input: EditarMonedaInput,
): Promise<MonedaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = editarMonedaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const moneda = await actualizarMoneda(monedaId, empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/monedas`);
    return { ok: true, monedaId: moneda.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarMonedaAction(
  empresaId: string,
  monedaId: string,
): Promise<EliminarMonedaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  try {
    await eliminarMoneda(monedaId, empresaId, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/monedas`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
