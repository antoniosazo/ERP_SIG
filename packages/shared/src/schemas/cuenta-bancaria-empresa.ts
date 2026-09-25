import { z } from "zod";
import { CUENTA_BANCARIA_TIPO } from "../enums";
import { fechaISO, uuid } from "./primitives";

/** Cuentas bancarias propias de la empresa ("bancos de la casa" en SAP B1). */
const camposCuentaBancariaEmpresaBase = {
  bancoId: uuid,
  tipoCuenta: z.enum(CUENTA_BANCARIA_TIPO).default("Corriente"),
  numeroCuenta: z.string().trim().min(1, "Número de cuenta requerido").max(40),
  alias: z.string().trim().max(80).nullish(),
  monedaId: uuid,
  /** Cuenta contable de tipo Banco donde se contabilizan los movimientos de esta cuenta. */
  cuentaContableId: uuid,
  activa: z.boolean().default(true),
  /** Punto de partida de la primera conciliación bancaria (Módulo de Bancos, Fase 1). */
  saldoInicialConciliado: z.number().default(0),
  fechaSaldoInicial: fechaISO.nullish(),
};

export const crearCuentaBancariaEmpresaSchema = z.object(camposCuentaBancariaEmpresaBase);
export type CrearCuentaBancariaEmpresaInput = z.infer<typeof crearCuentaBancariaEmpresaSchema>;
export const editarCuentaBancariaEmpresaSchema = z.object(camposCuentaBancariaEmpresaBase);
export type EditarCuentaBancariaEmpresaInput = z.infer<typeof editarCuentaBancariaEmpresaSchema>;
