"use server";

import { actualizarCuenta, crearCuenta } from "@erp/db";
import {
  crearCuentaSchema,
  editarCuentaSchema,
  type CrearCuentaInput,
  type EditarCuentaInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type CuentaResultado = { ok: true; cuentaId: string } | { ok: false; error: string };

const ROLES_CONFIG = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("plan_cuentas_empresa_codigo_unique")) {
      return "Ya existe una cuenta con ese código en esta empresa.";
    }
    return error.message;
  }
  return "Error desconocido";
}

export async function crearCuentaAction(
  empresaId: string,
  input: CrearCuentaInput,
): Promise<CuentaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = crearCuentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
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
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);

  const parsed = editarCuentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const cuenta = await actualizarCuenta(cuentaId, empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/configuracion/plan-cuentas`);
    return { ok: true, cuentaId: cuenta.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
