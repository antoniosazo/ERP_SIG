import { z } from "zod";
import {
  CLASE_CUENTA,
  CLASIFICACION_CORRIENTE,
  CUENTA_MODO_MONEDA,
  NATURALEZA_CUENTA,
  TIPO_CUENTA,
} from "../enums";
import { uuid } from "./primitives";

/**
 * Mantenedor de Plan de Cuentas por empresa (Módulo 4.9-D). `clase` solo se envía
 * en cuentas raíz; las hijas heredan la clase de su raíz en la capa de datos
 * (ver packages/db/src/queries/plan-cuentas.ts), igual que al clonar la plantilla.
 */
const camposCuentaBase = {
  cuentaPadreId: uuid.nullish(),
  codigoCuenta: z.string().min(1, "Código requerido").max(30),
  nombreCuenta: z.string().min(1, "Nombre requerido").max(200),
  clase: z.enum(CLASE_CUENTA),
  naturaleza: z.enum(NATURALEZA_CUENTA),
  tipoCuenta: z.enum(TIPO_CUENTA).default("Otra"),
  clasificacionCorriente: z.enum(CLASIFICACION_CORRIENTE).default("No Aplica"),
  nivelImputable: z.boolean().default(true),
  requiereCentroCosto: z.boolean().default(false),
  requiereAnalisisTerceros: z.boolean().default(false),
  modoMoneda: z.enum(CUENTA_MODO_MONEDA).default("Funcional"),
  monedaFijaId: uuid.nullish(),
  relevanteFlujoCaja: z.boolean().default(false),
  esCuentaAjuste: z.boolean().default(false),
  activa: z.boolean().default(true),
};

const refinarMonedaFija = (v: { modoMoneda?: string; monedaFijaId?: unknown }, ctx: z.RefinementCtx) => {
  if (v.modoMoneda === "Extranjera fija" && !v.monedaFijaId) {
    ctx.addIssue({
      code: "custom",
      path: ["monedaFijaId"],
      message: "Indica la moneda fija de la cuenta",
    });
  }
};

export const crearCuentaSchema = z.object(camposCuentaBase).superRefine(refinarMonedaFija);
export type CrearCuentaInput = z.infer<typeof crearCuentaSchema>;

export const editarCuentaSchema = z.object(camposCuentaBase).superRefine(refinarMonedaFija);
export type EditarCuentaInput = z.infer<typeof editarCuentaSchema>;
