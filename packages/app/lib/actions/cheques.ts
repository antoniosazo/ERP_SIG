"use server";

import { anularDeposito, protestarCheque, registrarDeposito } from "@erp/db";
import {
  anularPagoSchema,
  protestarChequeSchema,
  registrarDepositoSchema,
  type AnularPagoInput,
  type ProtestarChequeInput,
  type RegistrarDepositoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

const ROLES = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

function revalidar(empresaId: string) {
  for (const r of ["cheques", "depositos", "pagos-recibidos", "pagos-efectuados"]) {
    revalidatePath(`/panel/${empresaId}/tesoreria/${r}`);
  }
  revalidatePath(`/panel/${empresaId}/ventas/facturas`);
}

export async function depositarChequesAction(
  empresaId: string,
  input: RegistrarDepositoInput,
): Promise<{ ok: true; depositoId: string } | { ok: false; error: string }> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = registrarDepositoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const { deposito } = await registrarDeposito(empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, depositoId: deposito.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function anularDepositoAction(
  empresaId: string,
  depositoId: string,
  input: AnularPagoInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = anularPagoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await anularDeposito(depositoId, empresaId, parsed.data.motivo, auditCtx(session));
    revalidar(empresaId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function protestarChequeAction(
  empresaId: string,
  chequeId: string,
  input: ProtestarChequeInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = protestarChequeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await protestarCheque(chequeId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
