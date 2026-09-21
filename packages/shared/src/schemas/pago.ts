import { z } from "zod";
import { PAGO_TIPO } from "../enums";
import { fechaISO, uuid } from "./primitives";

const medioPagoSchema = z.object({
  metodoPagoId: uuid,
  monto: z.number().positive("El monto de cada medio de pago debe ser mayor a 0"),
  /** N° de transferencia / comprobante. */
  referencia: z.string().trim().max(80).nullish(),
  chequeNumero: z.string().trim().max(30).nullish(),
  chequeBancoId: uuid.nullish(),
  fechaCobro: fechaISO.nullish(),
});
export type MedioPagoInput = z.infer<typeof medioPagoSchema>;

const aplicacionSchema = z.object({
  documentoId: uuid,
  monto: z.number().positive("El monto aplicado a cada documento debe ser mayor a 0"),
});
export type AplicacionPagoInput = z.infer<typeof aplicacionSchema>;

/**
 * Registro de un pago recibido (cobro a cliente) o efectuado (pago a proveedor). Se
 * contabiliza al guardarse. Lo que exceda lo aplicado a documentos queda como anticipo
 * (pago a cuenta) del tercero. `Recibido` aplica a facturas de venta; `Efectuado`, a compra.
 */
export const registrarPagoSchema = z
  .object({
    tipo: z.enum(PAGO_TIPO),
    terceroId: uuid,
    fechaPago: fechaISO,
    fechaContabilizacion: fechaISO,
    glosa: z.string().trim().max(500).nullish(),
    referencia: z.string().trim().max(80).nullish(),
    medios: z.array(medioPagoSchema).min(1, "Agrega al menos un medio de pago").max(20),
    aplicaciones: z.array(aplicacionSchema).max(200).default([]),
  })
  .superRefine((v, ctx) => {
    const totalMedios = v.medios.reduce((a, m) => a + m.monto, 0);
    const totalAplicado = v.aplicaciones.reduce((a, m) => a + m.monto, 0);
    if (totalAplicado > totalMedios + 0.01) {
      ctx.addIssue({
        code: "custom",
        path: ["aplicaciones"],
        message: "Lo aplicado a documentos supera el monto de los medios de pago",
      });
    }
    const ids = v.aplicaciones.map((a) => a.documentoId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["aplicaciones"], message: "Un documento no puede repetirse en el pago" });
    }
  });
export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;

export const anularPagoSchema = z.object({
  motivo: z.string().trim().min(1, "Indica el motivo").max(500),
});
export type AnularPagoInput = z.infer<typeof anularPagoSchema>;
