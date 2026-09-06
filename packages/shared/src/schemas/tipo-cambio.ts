import { z } from "zod";
import { fechaISO, uuid } from "./primitives";

/**
 * Diff de la grilla de tipos de cambio: una entrada por celda cambiada.
 * `valor === null` borra el valor de esa celda; con número hace upsert.
 */
export const guardarTiposCambioSchema = z.object({
  cambios: z
    .array(
      z.object({
        monedaId: uuid,
        fecha: fechaISO,
        valor: z.number().positive().max(1e12).nullable(),
      }),
    )
    .max(500),
});

export type GuardarTiposCambioInput = z.infer<typeof guardarTiposCambioSchema>;
