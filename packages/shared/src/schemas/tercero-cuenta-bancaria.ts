import { z } from "zod";
import { CUENTA_BANCARIA_TIPO } from "../enums";
import { esRutValido } from "../rut";
import { uuid } from "./primitives";

/** Cuenta bancaria de un socio de negocio (para pagos/cobros) — sub-entidad de `terceros`. */
const camposCuentaBancariaBase = {
  bancoId: uuid,
  tipoCuenta: z.enum(CUENTA_BANCARIA_TIPO),
  numeroCuenta: z.string().trim().min(1, "Número de cuenta requerido").max(40),
  titular: z.string().trim().max(200).nullish(),
  rutTitular: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || esRutValido(v), "RUT inválido")
    .nullish(),
  esPrincipal: z.boolean().default(false),
};

export const crearCuentaBancariaSchema = z.object(camposCuentaBancariaBase);
export type CrearCuentaBancariaInput = z.infer<typeof crearCuentaBancariaSchema>;

export const editarCuentaBancariaSchema = z.object(camposCuentaBancariaBase);
export type EditarCuentaBancariaInput = z.infer<typeof editarCuentaBancariaSchema>;
