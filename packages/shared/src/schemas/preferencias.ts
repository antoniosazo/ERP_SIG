import { z } from "zod";

const seccionConfigSchema = z.object({
  orden: z.array(z.string().max(60)).max(200).default([]),
  ocultos: z.array(z.string().max(60)).max(200).default([]),
});

/**
 * Configuración de formulario por usuario para los documentos de venta:
 * orden y visibilidad de los campos de cabecera y de las columnas de línea.
 * Un `orden`/`ocultos` vacío = usar los valores por defecto del registro de campos.
 */
export const configFormularioDocSchema = z.object({
  cabecera: seccionConfigSchema.default({ orden: [], ocultos: [] }),
  linea: seccionConfigSchema.default({ orden: [], ocultos: [] }),
});
export type ConfigFormularioDoc = z.infer<typeof configFormularioDocSchema>;
