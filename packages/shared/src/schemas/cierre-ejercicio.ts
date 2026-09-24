import { z } from "zod";
import { uuid } from "./primitives";

/** Cierre de ejercicio: traspasa el resultado del año (ingresos − costos y gastos) a una
 * cuenta de Patrimonio y deja en cero las cuentas de resultado para ese año. */
export const cerrarEjercicioSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  cuentaResultadoId: uuid,
});
export type CerrarEjercicioInput = z.infer<typeof cerrarEjercicioSchema>;

export const reabrirEjercicioSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  motivo: z.string().trim().min(1, "Indica el motivo").max(500),
});
export type ReabrirEjercicioInput = z.infer<typeof reabrirEjercicioSchema>;
