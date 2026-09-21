import { z } from "zod";
import { fechaISO, uuid } from "./primitives";

/** Depósito de cheques en cartera a una cuenta bancaria de la empresa. */
export const registrarDepositoSchema = z.object({
  cuentaBancariaId: uuid,
  fecha: fechaISO,
  fechaContabilizacion: fechaISO,
  glosa: z.string().trim().max(300).nullish(),
  chequeIds: z.array(uuid).min(1, "Selecciona al menos un cheque").max(200),
});
export type RegistrarDepositoInput = z.infer<typeof registrarDepositoSchema>;

/** Cheque depositado que el banco devuelve: reabre la deuda del cliente. */
export const protestarChequeSchema = z.object({
  fecha: fechaISO,
  motivo: z.string().trim().min(1, "Indica el motivo del protesto").max(300),
  /** Comisión/gasto que cobra el banco por el protesto (opcional). */
  gastosProtesto: z.number().min(0).default(0),
  cuentaGastoId: uuid.nullish(),
});
export type ProtestarChequeInput = z.infer<typeof protestarChequeSchema>;
