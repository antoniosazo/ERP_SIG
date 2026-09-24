"use server";

import {
  actualizarEmpresa,
  actualizarVisualizacionEmpresa,
  crearEmpresaConInicializacion,
} from "@erp/db";
import {
  crearEmpresaSchema,
  editarEmpresaSchema,
  editarVisualizacionSchema,
  type CrearEmpresaInput,
  type EditarEmpresaInput,
  type EditarVisualizacionInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireAdminFirma, requireRolEnEmpresa } from "@/lib/auth-helpers";

export type CrearEmpresaResultado =
  | { ok: true; empresaId: string }
  | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("empresas_firma_rut_unique")) {
    return "Esta firma contable ya tiene una empresa con ese RUT.";
  }
  return error.message;
}

/**
 * Proceso 0 — Alta de empresa cliente. Crea la empresa, clona el plan de cuentas
 * de la plantilla elegida y abre el primer periodo contable (ver
 * packages/db/src/queries/empresas.ts). Solo Administrador de la firma.
 *
 * `firmaContableId` se toma de la sesión, nunca del formulario — evita que un input
 * manipulado cree una empresa bajo otra firma.
 */
export async function crearEmpresaAction(
  input: Omit<CrearEmpresaInput, "firmaContableId">,
): Promise<CrearEmpresaResultado> {
  const session = await requireAdminFirma();

  const parsed = crearEmpresaSchema.safeParse({
    ...input,
    firmaContableId: session.user.firmaContableId,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const empresa = await crearEmpresaConInicializacion(parsed.data, auditCtx(session));
    revalidatePath("/admin/empresas");
    return { ok: true, empresaId: empresa.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type EditarEmpresaResultado = { ok: true } | { ok: false; error: string };

/**
 * Edición de los "Detalles de la empresa" desde el entorno por empresa (Módulo 4.9-A).
 * Requiere rol Administrador en la empresa (o ser Administrador de la firma). El
 * `firmaContableId` sale de la sesión, nunca del formulario.
 */
export async function editarEmpresaAction(
  empresaId: string,
  input: EditarEmpresaInput,
): Promise<EditarEmpresaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ["Administrador"]);

  const parsed = editarEmpresaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await actualizarEmpresa(empresaId, session.user.firmaContableId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}`, "layout");
    revalidatePath("/admin/empresas");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/**
 * Configuración de "Visualización" (separadores decimal/miles y decimales por tipo de
 * dato), estilo pestaña de Configuración general de SAP B1. Solo Administrador.
 */
export async function editarVisualizacionAction(
  empresaId: string,
  input: EditarVisualizacionInput,
): Promise<EditarEmpresaResultado> {
  const session = await requireRolEnEmpresa(empresaId, ["Administrador"]);

  const parsed = editarVisualizacionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await actualizarVisualizacionEmpresa(empresaId, session.user.firmaContableId, parsed.data, auditCtx(session));
    revalidatePath(`/panel/${empresaId}`, "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
