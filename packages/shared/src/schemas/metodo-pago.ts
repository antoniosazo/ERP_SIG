import { z } from "zod";
import { METODO_PAGO_SENTIDO, METODO_PAGO_TIPO } from "../enums";
import { uuid } from "./primitives";

/**
 * Método de pago: define cómo se cobra o se paga y contra qué cuenta se contabiliza. La
 * cuenta efectiva es `cuentaContableId` si viene (ej. Caja, o una cuenta transitoria de
 * cheques por depositar); si no, la cuenta contable de la `cuentaBancariaId`.
 */
const camposMetodoPagoBase = {
  nombre: z.string().trim().min(1, "Nombre requerido").max(80),
  tipo: z.enum(METODO_PAGO_TIPO),
  sentido: z.enum(METODO_PAGO_SENTIDO).default("Ambos"),
  cuentaBancariaId: uuid.nullish(),
  cuentaContableId: uuid.nullish(),
  activo: z.boolean().default(true),
};

const refinarMetodoPago = (
  v: { tipo?: string; cuentaBancariaId?: unknown; cuentaContableId?: unknown },
  ctx: z.RefinementCtx,
) => {
  if (v.tipo === "Efectivo" && !v.cuentaContableId) {
    ctx.addIssue({ code: "custom", path: ["cuentaContableId"], message: "El efectivo requiere una cuenta contable (Caja)" });
  }
  if (v.tipo === "Transferencia" && !v.cuentaBancariaId) {
    ctx.addIssue({ code: "custom", path: ["cuentaBancariaId"], message: "La transferencia requiere una cuenta bancaria" });
  }
  if ((v.tipo === "Cheque" || v.tipo === "Tarjeta") && !v.cuentaBancariaId && !v.cuentaContableId) {
    ctx.addIssue({ code: "custom", path: ["cuentaBancariaId"], message: "Indica una cuenta bancaria o una cuenta contable" });
  }
};

export const crearMetodoPagoSchema = z.object(camposMetodoPagoBase).superRefine(refinarMetodoPago);
export type CrearMetodoPagoInput = z.infer<typeof crearMetodoPagoSchema>;
export const editarMetodoPagoSchema = z.object(camposMetodoPagoBase).superRefine(refinarMetodoPago);
export type EditarMetodoPagoInput = z.infer<typeof editarMetodoPagoSchema>;
