import { z } from "zod";
import { CATEGORIA_APLICA_A, IVA_RECUPERABLE } from "../enums";
import { uuid } from "./primitives";

/**
 * Mantenedor de Categorías Contables por empresa (3.11 / Módulo 4.9-D) — el mecanismo
 * de "determinación de cuentas" del sistema: qué cuenta de gasto/ingreso/costo/activo
 * usar automáticamente según la categoría del tercero.
 */
const camposCategoriaBase = {
  nombre: z.string().min(1, "Nombre requerido").max(200),
  aplicaA: z.enum(CATEGORIA_APLICA_A),
  cuentaGastoId: uuid.nullish(),
  cuentaIngresoId: uuid.nullish(),
  cuentaCostoId: uuid.nullish(),
  cuentaActivoId: uuid.nullish(),
  centroCostoDefaultId: uuid.nullish(),
  ivaRecuperableDefault: z.enum(IVA_RECUPERABLE).nullish(),
};

export const crearCategoriaSchema = z.object(camposCategoriaBase);
export type CrearCategoriaInput = z.infer<typeof crearCategoriaSchema>;

export const editarCategoriaSchema = z.object(camposCategoriaBase);
export type EditarCategoriaInput = z.infer<typeof editarCategoriaSchema>;
