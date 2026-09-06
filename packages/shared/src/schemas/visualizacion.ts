import { z } from "zod";
import { SEPARADOR_DECIMAL, SEPARADOR_MILES } from "../enums";

/**
 * Configuración de "Visualización" de una empresa (equivalente a la pestaña de
 * Configuración general de SAP B1): separadores y decimales por tipo de dato.
 */
export const editarVisualizacionSchema = z
  .object({
    separadorDecimal: z.enum(SEPARADOR_DECIMAL),
    separadorMiles: z.enum(SEPARADOR_MILES),
    // Los decimales de montos salen de `monedas.decimales`; aquí solo el tipo de cambio.
    decimalesTipoCambio: z.number().int().min(0).max(6),
  })
  .refine((v) => v.separadorDecimal !== v.separadorMiles, {
    message: "El separador decimal y el de miles deben ser distintos",
    path: ["separadorMiles"],
  });

export type EditarVisualizacionInput = z.infer<typeof editarVisualizacionSchema>;
