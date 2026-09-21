import { check, date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, montoColumn, timestampsColumns, tipoCambioColumn } from "./columns.helpers";
import { metodoPagoTipoEnum, pagoEstadoEnum, pagoTipoEnum } from "./enums";
import { asientosContables } from "./asientos-contables";
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
    montoAplicado: montoColumn("monto_aplicado").notNull(),
  },
  (t) => [
    check(
      "pagos_documentos_un_documento",
      sql`(${t.documentoCompraId} is null) <> (${t.documentoVentaId} is null)`,
    ),
  ],
);
