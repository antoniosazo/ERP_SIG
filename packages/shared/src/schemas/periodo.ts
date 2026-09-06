import { z } from "zod";
import { PERIODO_ESTADO, PERIODO_ESTADOS_BLOQUEADOS } from "../enums";

/** Genera los 12 meses de un ejercicio (año calendario) para una empresa. */
export const generarEjercicioSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
});
export type GenerarEjercicioInput = z.infer<typeof generarEjercicioSchema>;

/**
 * Cambio de "Status del período" (estilo SAP B1). El `motivo` es obligatorio al
 * **reabrir** (volver a `Desbloqueado` desde un estado bloqueado / de cierre); ese
 * caso no se puede validar solo con el estado destino, así que la capa de datos
 * revalida contra el estado actual del periodo.
 */
export const cambiarEstadoPeriodoSchema = z.object({
  estado: z.enum(PERIODO_ESTADO),
  motivo: z.string().max(500).optional(),
});
export type CambiarEstadoPeriodoInput = z.infer<typeof cambiarEstadoPeriodoSchema>;

/** True si `estado` bloquea (total o parcialmente) la contabilización. */
export function esEstadoBloqueado(estado: string): boolean {
  return (PERIODO_ESTADOS_BLOQUEADOS as readonly string[]).includes(estado);
}
