"use server";

import {
  actualizarCuentaBancariaEmpresa,
  actualizarMetodoPago,
  crearCuentaBancariaEmpresa,
  crearMetodoPago,
} from "@erp/db";
import {
  crearCuentaBancariaEmpresaSchema,
  crearMetodoPagoSchema,
  type CrearCuentaBancariaEmpresaInput,
  type CrearMetodoPagoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type TesoreriaResultado = { ok: true; id: string } | { ok: false; error: string };

const ROLES_CONFIG = ["Administrador", "Contador"];

function mensajeError(error: unknown): string {
  if (error instanceof Error) {
    const texto = `${error.message} ${(error as { cause?: { message?: string } }).cause?.message ?? ""}`;
    if (texto.includes("cuentas_bancarias_empresa_banco_numero_unique")) {
      return "Ya existe una cuenta con ese banco y número en esta empresa.";
    }
    if (texto.includes("metodos_pago_empresa_nombre_unique")) {
      return "Ya existe un método de pago con ese nombre.";
    }
    return error.message;
  }
  return "Error desconocido";
}

const rutas = (empresaId: string) => [
  `/panel/${empresaId}/configuracion/cuentas-bancarias`,
  `/panel/${empresaId}/configuracion/metodos-pago`,
];

export async function guardarCuentaBancariaAction(
  empresaId: string,
  cuentaId: string | null,
  input: CrearCuentaBancariaEmpresaInput,
): Promise<TesoreriaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = crearCuentaBancariaEmpresaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const ctx = auditCtx(session);
    const cuenta = cuentaId
      ? await actualizarCuentaBancariaEmpresa(cuentaId, empresaId, parsed.data, ctx)
      : await crearCuentaBancariaEmpresa(empresaId, parsed.data, ctx);
    for (const r of rutas(empresaId)) revalidatePath(r);
    return { ok: true, id: cuenta.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function guardarMetodoPagoAction(
  empresaId: string,
  metodoId: string | null,
  input: CrearMetodoPagoInput,
): Promise<TesoreriaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES_CONFIG);
  const parsed = crearMetodoPagoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const ctx = auditCtx(session);
    const metodo = metodoId
      ? await actualizarMetodoPago(metodoId, empresaId, parsed.data, ctx)
      : await crearMetodoPago(empresaId, parsed.data, ctx);
    for (const r of rutas(empresaId)) revalidatePath(r);
    return { ok: true, id: metodo.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
