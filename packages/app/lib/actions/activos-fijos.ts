"use server";

import {
  activarObraEnCurso,
  actualizarActivoFijo,
  anularDocumentoActivoFijo,
  bajaActivo,
  capitalizarActivo,
  crearActivoFijo,
  ejecutarDepreciacion,
  listarAuditoriaDeRegistro,
  pronosticoDepreciacion,
  registrarDepreciacionManual,
  registrarMejora,
  transferirCentroCosto,
  transferirClase,
  type FilaPronostico,
  type SimulacionDepreciacion,
} from "@erp/db";
import {
  activarObraEnCursoSchema,
  anularDocumentoActivoFijoSchema,
  bajaActivoSchema,
  capitalizarActivoSchema,
  crearActivoFijoSchema,
  ejecutarDepreciacionSchema,
  pronosticoDepreciacionSchema,
  registrarDepreciacionManualSchema,
  registrarMejoraSchema,
  transferirCentroCostoSchema,
  transferirClaseSchema,
  type ActivarObraEnCursoInput,
  type AnularDocumentoActivoFijoInput,
  type BajaActivoInput,
  type CapitalizarActivoInput,
  type CrearActivoFijoInput,
  type EjecutarDepreciacionInput,
  type LibroContable,
  type PronosticoDepreciacionInput,
  type RegistrarDepreciacionManualInput,
  type RegistrarMejoraInput,
  type TransferirCentroCostoInput,
  type TransferirClaseInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import type { HistorialResultado } from "@/lib/actions/ventas";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";

const ROLES = ["Administrador", "Contador"];

type Resultado = { ok: true; id: string } | { ok: false; error: string };

function mensajeError(error: unknown): string {
  if (!(error instanceof Error)) return "Error desconocido";
  const texto = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`;
  if (texto.includes("activos_fijos_empresa_codigo_unique")) {
    return "Ya existe un activo con ese código en esta empresa.";
  }
  return error.message;
}

function revalidar(empresaId: string, activoId?: string) {
  revalidatePath(`/panel/${empresaId}/activos-fijos/activos`);
  if (activoId) revalidatePath(`/panel/${empresaId}/activos-fijos/activos/${activoId}`);
  revalidatePath(`/panel/${empresaId}/informes/activos-fijos`);
}

export async function crearActivoFijoAction(empresaId: string, input: CrearActivoFijoInput): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = crearActivoFijoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const activo = await crearActivoFijo(empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, id: activo.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function editarActivoFijoAction(
  empresaId: string,
  activoId: string,
  input: CrearActivoFijoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = crearActivoFijoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const activo = await actualizarActivoFijo(activoId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId, activo.id);
    return { ok: true, id: activo.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function capitalizarActivoAction(
  empresaId: string,
  activoId: string,
  input: CapitalizarActivoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = capitalizarActivoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const { activo } = await capitalizarActivo(activoId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId, activo.id);
    return { ok: true, id: activo.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type EjecutarDepreciacionResultado =
  | { ok: true; modo: "simulacion"; data: SimulacionDepreciacion }
  | { ok: true; modo: "real"; documentoId: string; totalCuota: number; activos: number }
  | { ok: false; error: string };

export async function ejecutarDepreciacionAction(
  empresaId: string,
  input: EjecutarDepreciacionInput,
): Promise<EjecutarDepreciacionResultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = ejecutarDepreciacionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const resultado = await ejecutarDepreciacion(empresaId, parsed.data, auditCtx(session));
    if (parsed.data.modo === "simulacion") {
      return { ok: true, modo: "simulacion", data: resultado as SimulacionDepreciacion };
    }
    revalidar(empresaId);
    const real = resultado as { documentoId: string; totalCuota: number; filas: unknown[] };
    return { ok: true, modo: "real", documentoId: real.documentoId, totalCuota: real.totalCuota, activos: real.filas.length };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function registrarMejoraAction(
  empresaId: string,
  activoId: string,
  input: RegistrarMejoraInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = registrarMejoraSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await registrarMejora(activoId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId, activoId);
    return { ok: true, id: activoId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function activarObraEnCursoAction(
  empresaId: string,
  activoId: string,
  input: ActivarObraEnCursoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = activarObraEnCursoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await activarObraEnCurso(activoId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId, activoId);
    return { ok: true, id: activoId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function transferirCentroCostoAction(
  empresaId: string,
  activoId: string,
  input: TransferirCentroCostoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = transferirCentroCostoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await transferirCentroCosto(activoId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId, activoId);
    return { ok: true, id: activoId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function transferirClaseAction(
  empresaId: string,
  activoId: string,
  input: TransferirClaseInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = transferirClaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await transferirClase(activoId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId, activoId);
    return { ok: true, id: activoId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function bajarActivoAction(
  empresaId: string,
  activoId: string,
  input: BajaActivoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = bajaActivoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await bajaActivo(activoId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId, activoId);
    return { ok: true, id: activoId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function registrarDepreciacionManualAction(
  empresaId: string,
  activoId: string,
  input: RegistrarDepreciacionManualInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = registrarDepreciacionManualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    await registrarDepreciacionManual(activoId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId, activoId);
    return { ok: true, id: activoId };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export async function anularDocumentoActivoFijoAction(
  empresaId: string,
  documentoId: string,
  input: AnularDocumentoActivoFijoInput,
): Promise<Resultado> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = anularDocumentoActivoFijoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const { documento } = await anularDocumentoActivoFijo(documentoId, empresaId, parsed.data, auditCtx(session));
    revalidar(empresaId);
    return { ok: true, id: documento.id };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

export type PronosticoDepreciacionResultado =
  | { ok: true; filas: FilaPronostico[] }
  | { ok: false; error: string };

export async function pronosticoDepreciacionAction(
  empresaId: string,
  activoId: string,
  input: PronosticoDepreciacionInput,
): Promise<PronosticoDepreciacionResultado> {
  await requireRolEnEmpresa(empresaId, ROLES);
  const parsed = pronosticoDepreciacionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const filas = await pronosticoDepreciacion(empresaId, activoId, parsed.data.libro as LibroContable, parsed.data.meses);
    return { ok: true, filas };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/** Bitácora de modificaciones de este activo fijo. */
export async function historialActivoFijoAction(empresaId: string, activoId: string): Promise<HistorialResultado> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const filas = await listarAuditoriaDeRegistro(empresaId, "activos_fijos", activoId);
    return {
      ok: true,
      filas: filas.map((f) => ({
        id: f.id,
        creadoEn: f.creadoEn.toISOString(),
        usuarioNombre: f.usuarioNombre,
        accion: f.accion,
        motivo: f.motivo,
        valoresAnteriores: (f.valoresAnteriores as Record<string, unknown> | null) ?? null,
        valoresNuevos: (f.valoresNuevos as Record<string, unknown> | null) ?? null,
      })),
    };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
