import { z } from "zod";
import { DETERMINACION_CONTEXTO, DETERMINACION_ROL } from "../enums";
import { uuid } from "./primitives";

/**
 * Regla de determinación de cuenta a nivel GENERAL (por empresa): "para este rol contable
 * en este contexto, usa esta cuenta". `cuentaId` nulo = borrar la regla.
 */
export const guardarReglaDeterminacionSchema = z.object({
  contexto: z.enum(DETERMINACION_CONTEXTO),
  rol: z.enum(DETERMINACION_ROL),
  cuentaId: uuid.nullish(),
});
export type GuardarReglaDeterminacionInput = z.infer<typeof guardarReglaDeterminacionSchema>;
