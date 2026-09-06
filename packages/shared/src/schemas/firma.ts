import { z } from "zod";
import { FIRMA_ESTADO, PLAN_CONTRATADO } from "../enums";
import { esRutValido } from "../rut";

export const crearFirmaContableSchema = z.object({
  rut: z
    .string()
    .min(3, "RUT requerido")
    .refine(esRutValido, "RUT inválido (verifica el dígito verificador)"),
  razonSocial: z.string().min(1, "Razón social requerida").max(200),
  planContratado: z.enum(PLAN_CONTRATADO).default("Basico"),
  estado: z.enum(FIRMA_ESTADO).default("Activa"),
});

export type CrearFirmaContableInput = z.infer<typeof crearFirmaContableSchema>;

/** Edición de "Mi firma" (4.9-E) — el RUT no se edita, es el identificador legal. */
export const actualizarFirmaContableSchema = z.object({
  razonSocial: z.string().min(1, "Razón social requerida").max(200),
  planContratado: z.enum(PLAN_CONTRATADO),
  estado: z.enum(FIRMA_ESTADO),
});

export type ActualizarFirmaContableInput = z.infer<typeof actualizarFirmaContableSchema>;
