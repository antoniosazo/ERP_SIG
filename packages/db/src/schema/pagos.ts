import { check, date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, montoColumn, timestampsColumns, tipoCambioColumn } from "./columns.helpers";
import { chequeEstadoEnum, chequeTipoEnum, metodoPagoTipoEnum, pagoEstadoEnum, pagoTipoEnum } from "./enums";
import { asientosContables } from "./asientos-contables";
import { cuentasBancarias } from "./cuentas-bancarias";
import { bancos } from "./bancos";
import { documentosCompra } from "./documentos-compra";
import { documentosVenta } from "./documentos-venta";
import { empresas } from "./empresas";
import { metodosPago } from "./metodos-pago";
import { monedas } from "./monedas";
import { planCuentas } from "./plan-cuentas";
import { terceros } from "./terceros";
import { usuarios } from "./usuarios";

/**
 * Pagos recibidos (cobros a clientes) y efectuados (pagos a proveedores), al estilo de
 * SAP B1 (ORCT/OVPM). Se contabilizan al registrarse: no existe borrador. Lo aplicado a
 * documentos vive en `pagos_documentos`; lo que sobra es anticipo del tercero
 * (`montoTotal - montoAplicado`). Anular genera el asiento de reversa y devuelve el saldo.
 */
export const pagos = pgTable(
  "pagos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    tipo: pagoTipoEnum("tipo").notNull(),
    numeroInterno: text("numero_interno").notNull(),
    terceroId: uuid("tercero_id")
      .notNull()
      .references(() => terceros.id, { onDelete: "restrict" }),
    fechaPago: date("fecha_pago").notNull(),
    fechaContabilizacion: date("fecha_contabilizacion").notNull(),
    monedaId: uuid("moneda_id")
      .notNull()
      .references(() => monedas.id, { onDelete: "restrict" }),
    tipoCambio: tipoCambioColumn("tipo_cambio").notNull().default("1"),
    montoTotal: montoColumn("monto_total").notNull().default("0"),
    montoAplicado: montoColumn("monto_aplicado").notNull().default("0"),
    glosa: text("glosa"),
    referencia: text("referencia"),
    estado: pagoEstadoEnum("estado").notNull().default("contabilizado"),
    asientoId: uuid("asiento_id").references(() => asientosContables.id, { onDelete: "set null" }),
    asientoReversaId: uuid("asiento_reversa_id").references(() => asientosContables.id, { onDelete: "set null" }),
    motivoAnulacion: text("motivo_anulacion"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("pagos_empresa_numero_unique").on(t.empresaId, t.numeroInterno)],
);

/** Una línea por medio de pago usado (efectivo, cheque, transferencia…). */
export const pagosMedios = pgTable("pagos_medios", {
  id: idColumn(),
  pagoId: uuid("pago_id")
    .notNull()
    .references(() => pagos.id, { onDelete: "cascade" }),
  numeroLinea: integer("numero_linea").notNull(),
  metodoPagoId: uuid("metodo_pago_id")
    .notNull()
    .references(() => metodosPago.id, { onDelete: "restrict" }),
  tipo: metodoPagoTipoEnum("tipo").notNull(),
  /** Cuenta contable efectiva usada al contabilizar (queda fija aunque el método cambie después). */
  cuentaId: uuid("cuenta_id")
    .notNull()
    .references(() => planCuentas.id, { onDelete: "restrict" }),
  monto: montoColumn("monto").notNull(),
  referencia: text("referencia"),
  chequeNumero: text("cheque_numero"),
  chequeBancoId: uuid("cheque_banco_id").references(() => bancos.id, { onDelete: "set null" }),
  fechaCobro: date("fecha_cobro"),
});

/**
 * Registro de cheques (no es un maestro que se digita: nace de la línea de cheque de un
 * pago, como RCT1 en SAP B1). Recibidos: en_cartera → depositado → (protestado).
 * Emitidos: emitido → cobrado. El depósito los liga por `depositoId`.
 */
export const cheques = pgTable(
  "cheques",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    tipo: chequeTipoEnum("tipo").notNull(),
    pagoId: uuid("pago_id")
      .notNull()
      .references(() => pagos.id, { onDelete: "restrict" }),
    pagoMedioId: uuid("pago_medio_id")
      .notNull()
      .references(() => pagosMedios.id, { onDelete: "restrict" }),
    terceroId: uuid("tercero_id")
      .notNull()
      .references(() => terceros.id, { onDelete: "restrict" }),
    numero: text("numero").notNull(),
    bancoId: uuid("banco_id").references(() => bancos.id, { onDelete: "set null" }),
    monto: montoColumn("monto").notNull(),
    fechaEmision: date("fecha_emision").notNull(),
    /** Fecha desde la que se puede cobrar (cheque a fecha); vacía = a la vista. */
    fechaCobro: date("fecha_cobro"),
    estado: chequeEstadoEnum("estado").notNull(),
    depositoId: uuid("deposito_id"),
    fechaProtesto: date("fecha_protesto"),
    motivoProtesto: text("motivo_protesto"),
    asientoProtestoId: uuid("asiento_protesto_id").references(() => asientosContables.id, { onDelete: "set null" }),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("cheques_pago_medio_unique").on(t.pagoMedioId)],
);

/** Depósito de cheques en cartera a una cuenta bancaria propia (DPS de SAP B1). */
export const depositos = pgTable(
  "depositos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    numeroInterno: text("numero_interno").notNull(),
    fecha: date("fecha").notNull(),
    fechaContabilizacion: date("fecha_contabilizacion").notNull(),
    cuentaBancariaId: uuid("cuenta_bancaria_id")
      .notNull()
      .references(() => cuentasBancarias.id, { onDelete: "restrict" }),
    montoTotal: montoColumn("monto_total").notNull(),
    glosa: text("glosa"),
    estado: pagoEstadoEnum("estado").notNull().default("contabilizado"),
    asientoId: uuid("asiento_id").references(() => asientosContables.id, { onDelete: "set null" }),
    asientoReversaId: uuid("asiento_reversa_id").references(() => asientosContables.id, { onDelete: "set null" }),
    motivoAnulacion: text("motivo_anulacion"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("depositos_empresa_numero_unique").on(t.empresaId, t.numeroInterno)],
);

/** Cheques incluidos en cada depósito (se conserva aunque el depósito se anule). */
export const depositosCheques = pgTable(
  "depositos_cheques",
  {
    id: idColumn(),
    depositoId: uuid("deposito_id")
      .notNull()
      .references(() => depositos.id, { onDelete: "cascade" }),
    chequeId: uuid("cheque_id")
      .notNull()
      .references(() => cheques.id, { onDelete: "restrict" }),
    monto: montoColumn("monto").notNull(),
  },
  (t) => [uniqueIndex("depositos_cheques_unico").on(t.depositoId, t.chequeId)],
);

/** Aplicación del pago a un documento (equivale a VPM2/RCT2 de SAP B1). */
export const pagosDocumentos = pgTable(
  "pagos_documentos",
  {
    id: idColumn(),
    pagoId: uuid("pago_id")
      .notNull()
      .references(() => pagos.id, { onDelete: "cascade" }),
    documentoCompraId: uuid("documento_compra_id").references(() => documentosCompra.id, { onDelete: "restrict" }),
    documentoVentaId: uuid("documento_venta_id").references(() => documentosVenta.id, { onDelete: "restrict" }),
    /** Negativo cuando reabre la deuda por un cheque protestado. */
    montoAplicado: montoColumn("monto_aplicado").notNull(),
    chequeId: uuid("cheque_id").references(() => cheques.id, { onDelete: "restrict" }),
  },
  (t) => [
    check(
      "pagos_documentos_un_documento",
      sql`(${t.documentoCompraId} is null) <> (${t.documentoVentaId} is null)`,
    ),
  ],
);
