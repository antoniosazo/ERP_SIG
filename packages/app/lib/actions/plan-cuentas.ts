"use server";

import { actualizarCuenta, crearCuenta } from "@erp/db";
import {
  ROLES_CONFIG_PLAN_CUENTAS,
  crearCuentaSchema,
  editarCuentaSchema,
  type CrearCuentaInput,
  type EditarCuentaInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type CuentaResultado = { ok: true; cuentaId: string } | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("plan_cuentas_empresa_codigo_unique")) {
    return "Ya existe una cuenta con ese código en esta empresa.";
  }
  return error.message;
}

export async function crearCuentaAction(
  empresaId: string,
  input: CrearCuentaInput,
): Promise<CuentaResultado> {
  const parsed = crearCuentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG_PLAN_CUENTAS);
    const cuenta = await crearCuenta(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/plan-cuentas`);
    return { ok: true, cuentaId: cuenta.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarCuentaAction(
  empresaId: string,
  cuentaId: string,
  input: EditarCuentaInput,
): Promise<CuentaResultado> {
  const parsed = editarCuentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG_PLAN_CUENTAS);
    const cuenta = await actualizarCuenta(cuentaId, empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/plan-cuentas`);
    return { ok: true, cuentaId: cuenta.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
