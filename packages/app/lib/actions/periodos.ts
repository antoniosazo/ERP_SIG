"use server";

import { cambiarEstadoPeriodo, generarEjercicio } from "@erp/db";
import {
  cambiarEstadoPeriodoSchema,
  generarEjercicioSchema,
  type CambiarEstadoPeriodoInput,
} from "@erp/shared";
import { revalidatePath } from "next/cache";
import { requireRolEnEmpresa } from "@/lib/auth-helpers";

export type GenerarEjercicioResultado =
  | { ok: true; creados: number }
  | { ok: false; error: string };

export type CambiarEstadoPeriodoResultado = { ok: true } | { ok: false; error: string };

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

export async function generarEjercicioAction(
  empresaId: string,
  anio: number,
): Promise<GenerarEjercicioResultado> {
  await requireRolEnEmpresa(empresaId, ["Administrador", "Contador"]);

  const parsed = generarEjercicioSchema.safeParse({ anio });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const creados = await generarEjercicio(empresaId, parsed.data.anio);
    revalidatePath(`/panel/${empresaId}/configuracion/periodos`);
    return { ok: true, creados };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}

/**
 * Cambio de "Status del período". Reabrir (volver a `Desbloqueado` desde un estado
 * bloqueado o de cierre) exige rol Administrador y un motivo; el resto de transiciones
 * las puede hacer un Contador.
 */
export async function cambiarEstadoPeriodoAction(
  empresaId: string,
  periodoId: string,
  input: CambiarEstadoPeriodoInput,
): Promise<CambiarEstadoPeriodoResultado> {
  const parsed = cambiarEstadoPeriodoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const esReapertura = parsed.data.estado === "Desbloqueado";
  const session = await requireRolEnEmpresa(
    empresaId,
    esReapertura ? ["Administrador"] : ["Administrador", "Contador"],
  );

  try {
    await cambiarEstadoPeriodo(periodoId, empresaId, {
      ...parsed.data,
      usuarioId: session.user.id,
      usuarioNombre: session.user.name ?? "—",
    });
    revalidatePath(`/panel/${empresaId}/configuracion/periodos`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeError(error) };
  }
}
