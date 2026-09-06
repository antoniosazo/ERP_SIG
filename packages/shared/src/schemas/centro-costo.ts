import { z } from "zod";
import { uuid } from "./primitives";

/** Mantenedor de Centros de Costo por empresa (3.3 / Módulo 4.9-D). Jerárquico. */
const camposCentroCostoBase = {
  centroPadreId: uuid.nullish(),
  codigo: z.string().min(1, "Código requerido").max(30),
  nombre: z.string().min(1, "Nombre requerido").max(200),
  estado: z.enum(["Activo", "Inactivo"]).default("Activo"),
};

export const crearCentroCostoSchema = z.object(camposCentroCostoBase);
export type CrearCentroCostoInput = z.infer<typeof crearCentroCostoSchema>;

export const editarCentroCostoSchema = z.object(camposCentroCostoBase);
export type EditarCentroCostoInput = z.infer<typeof editarCentroCostoSchema>;
