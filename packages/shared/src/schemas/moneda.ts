import { z } from "zod";
import { MONEDA_TIPO } from "../enums";

/** Maestro de Monedas por empresa (3.9). Cada empresa tiene su propia lista (clonada al alta). */
const camposMonedaBase = {
  codigo: z
    .string()
    .trim()
    .min(1, "Código requerido")
    .max(10)
    .transform((v) => v.toUpperCase()),
  nombre: z.string().trim().min(1, "Nombre requerido").max(100),
  tipo: z.enum(MONEDA_TIPO),
  simbolo: z.string().trim().min(1, "Símbolo requerido").max(8),
  decimales: z.number().int().min(0).max(8),
  codigoIso: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "El código ISO debe tener 3 letras (ej. CLP)")
    .nullish(),
};

export const crearMonedaSchema = z.object(camposMonedaBase);
export type CrearMonedaInput = z.infer<typeof crearMonedaSchema>;

export const editarMonedaSchema = z.object(camposMonedaBase);
export type EditarMonedaInput = z.infer<typeof editarMonedaSchema>;
