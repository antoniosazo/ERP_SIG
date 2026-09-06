"use server";

import {
  actualizarContacto,
  actualizarCuentaBancaria,
  actualizarDireccion,
  actualizarTercero,
  crearContacto,
  crearCuentaBancaria,
  crearDireccion,
  crearTercero,
  eliminarContacto,
  eliminarCuentaBancaria,
  eliminarDireccion,
} from "@erp/db";
import {
  crearContactoSchema,
  crearCuentaBancariaSchema,
  crearDireccionSchema,
  crearTerceroSchema,
  editarContactoSchema,
  editarCuentaBancariaSchema,
  editarDireccionSchema,
  editarTerceroSchema,
  type CrearContactoInput,
  type CrearCuentaBancariaInput,
  type CrearDireccionInput,
  type CrearTerceroInput,
  type EditarContactoInput,
  type EditarCuentaBancariaInput,
  type EditarDireccionInput,
  type EditarTerceroInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type TerceroResultado = { ok: true; terceroId: string } | { ok: false; error: string };
export type SubResultado = { ok: true } | { ok: false; error: string };

const ROLES_CONFIG = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("terceros_empresa_rut_unique")) {
      return "Ya existe un tercero con ese RUT en esta empresa.";
    }
    return error.message;
  }
  return "Error desconocido";
}

function issue(error: { issues: { message?: string }[] }) {
  return { ok: false as const, error: error.issues[0]?.message ?? "Datos inválidos" };
}

// ── Cabecera ─────────────────────────────────────────────────────────────────

export async function crearTerceroAction(
  empresaId: string,
  input: CrearTerceroInput,
): Promise<TerceroResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = crearTerceroSchema.safeParse(input);
  if (!parsed.success) return issue(parsed.error);
  try {
    const tercero = await crearTercero(empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/maestros/terceros`);
    return { ok: true, terceroId: tercero.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarTerceroAction(
  empresaId: string,
  terceroId: string,
  input: EditarTerceroInput,
): Promise<TerceroResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = editarTerceroSchema.safeParse(input);
  if (!parsed.success) return issue(parsed.error);
  try {
    const tercero = await actualizarTercero(terceroId, empresaId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}/maestros/terceros`);
    revalidatePath(`/panel/${empresaId}/maestros/terceros/${terceroId}`);
    return { ok: true, terceroId: tercero.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

// ── Sub-entidades ────────────────────────────────────────────────────────────

async function revalidarDetalle(empresaId: string, terceroId: string) {
  revalidatePath(`/panel/${empresaId}/maestros/terceros/${terceroId}`);
}

export async function crearContactoAction(
  empresaId: string,
  terceroId: string,
  input: CrearContactoInput,
): Promise<SubResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = crearContactoSchema.safeParse(input);
  if (!parsed.success) return issue(parsed.error);
  try {
    await crearContacto(terceroId, empresaId, parsed.data, auditCtx(session));
    await revalidarDetalle(empresaId, terceroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarContactoAction(
  empresaId: string,
  terceroId: string,
  contactoId: string,
  input: EditarContactoInput,
): Promise<SubResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = editarContactoSchema.safeParse(input);
  if (!parsed.success) return issue(parsed.error);
  try {
    await actualizarContacto(contactoId, terceroId, empresaId, parsed.data, auditCtx(session));
    await revalidarDetalle(empresaId, terceroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarContactoAction(
  empresaId: string,
  terceroId: string,
  contactoId: string,
): Promise<SubResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  try {
    await eliminarContacto(contactoId, terceroId, empresaId, auditCtx(session));
    await revalidarDetalle(empresaId, terceroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function crearDireccionAction(
  empresaId: string,
  terceroId: string,
  input: CrearDireccionInput,
): Promise<SubResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = crearDireccionSchema.safeParse(input);
  if (!parsed.success) return issue(parsed.error);
  try {
    await crearDireccion(terceroId, empresaId, parsed.data, auditCtx(session));
    await revalidarDetalle(empresaId, terceroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarDireccionAction(
  empresaId: string,
  terceroId: string,
  direccionId: string,
  input: EditarDireccionInput,
): Promise<SubResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = editarDireccionSchema.safeParse(input);
  if (!parsed.success) return issue(parsed.error);
  try {
    await actualizarDireccion(direccionId, terceroId, empresaId, parsed.data, auditCtx(session));
    await revalidarDetalle(empresaId, terceroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarDireccionAction(
  empresaId: string,
  terceroId: string,
  direccionId: string,
): Promise<SubResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  try {
    await eliminarDireccion(direccionId, terceroId, empresaId, auditCtx(session));
    await revalidarDetalle(empresaId, terceroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function crearCuentaBancariaAction(
  empresaId: string,
  terceroId: string,
  input: CrearCuentaBancariaInput,
): Promise<SubResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = crearCuentaBancariaSchema.safeParse(input);
  if (!parsed.success) return issue(parsed.error);
  try {
    await crearCuentaBancaria(terceroId, empresaId, parsed.data, auditCtx(session));
    await revalidarDetalle(empresaId, terceroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarCuentaBancariaAction(
  empresaId: string,
  terceroId: string,
  cuentaId: string,
  input: EditarCuentaBancariaInput,
): Promise<SubResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = editarCuentaBancariaSchema.safeParse(input);
  if (!parsed.success) return issue(parsed.error);
  try {
    await actualizarCuentaBancaria(cuentaId, terceroId, empresaId, parsed.data, auditCtx(session));
    await revalidarDetalle(empresaId, terceroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function eliminarCuentaBancariaAction(
  empresaId: string,
  terceroId: string,
  cuentaId: string,
): Promise<SubResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  try {
    await eliminarCuentaBancaria(cuentaId, terceroId, empresaId, auditCtx(session));
    await revalidarDetalle(empresaId, terceroId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
