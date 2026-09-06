import { z } from "zod";
import { DIRECCION_TIPO } from "../enums";

/** Dirección (Facturación / Despacho) de un socio de negocio — sub-entidad de `terceros`. */
const camposDireccionBase = {
  tipo: z.enum(DIRECCION_TIPO),
  nombre: z.string().trim().max(100).nullish(),
  calle: z.string().trim().max(150).nullish(),
  numero: z.string().trim().max(30).nullish(),
  comuna: z.string().trim().max(100).nullish(),
  ciudad: z.string().trim().max(100).nullish(),
  region: z.string().trim().max(100).nullish(),
  pais: z.string().trim().max(60).default("Chile"),
  codigoPostal: z.string().trim().max(20).nullish(),
  esPrincipal: z.boolean().default(false),
};

export const crearDireccionSchema = z.object(camposDireccionBase);
export type CrearDireccionInput = z.infer<typeof crearDireccionSchema>;

export const editarDireccionSchema = z.object(camposDireccionBase);
export type EditarDireccionInput = z.infer<typeof editarDireccionSchema>;
