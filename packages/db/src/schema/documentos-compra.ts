import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { date, index, integer, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { documentoCompraEstadoEnum, documentoCompraTipoEnum } from "./enums";
import { asientosContables } from "./asientos-contables";
import { empresas } from "./empresas";
import { monedas } from "./monedas";
import { terceros } from "./terceros";
import { tiposDocumento } from "./tipos-documento";
import { usuarios } from "./usuarios";

/**
 * Módulo de Compras — cabecera. Un solo modelo para todo el flujo documental
 * (`docTipo`: pedido / entrada de mercadería / factura / NC / ND), espejo de
 * `documentos_venta`. `numeroInterno` = serie `compra/<docTipo>`. Las facturas/NC/ND
 * generan asiento al contabilizar; el pedido solo controla el saldo pendiente por línea
 * (`documentos_compra_lineas.cantidadPendiente`).
 */
export const documentosCompra = pgTable(
  "documentos_compra",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    docTipo: documentoCompraTipoEnum("doc_tipo").notNull(),
    numeroInterno: text("numero_interno"),
    tipoDocumentoId: uuid("tipo_documento_id")
      .notNull()
      .references(() => tiposDocumento.id, { onDelete: "restrict" }),
    terceroId: uuid("tercero_id")
      .notNull()
      .references(() => terceros.id, { onDelete: "restrict" }),
    folio: text("folio"),
    fechaEmision: date("fecha_emision").notNull(),
    fechaVencimiento: date("fecha_vencimiento"),
    fechaContabilizacion: date("fecha_contabilizacion"),
    numAtCard: text("num_at_card"),
    monedaId: uuid("moneda_id")
      .notNull()
      .references(() => monedas.id, { onDelete: "restrict" }),
    tipoCambio: numeric("tipo_cambio", { precision: 18, scale: 6 }).notNull().default("1"),
    descuentoGlobalPct: numeric("descuento_global_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    condicionPagoDias: integer("condicion_pago_dias"),
    montoNeto: montoColumn("monto_neto").notNull().default("0"),
    montoExento: montoColumn("monto_exento").notNull().default("0"),
    montoImpuesto: montoColumn("monto_impuesto").notNull().default("0"),
    montoIvaNoRecuperable: montoColumn("monto_iva_no_recuperable").notNull().default("0"),
    montoTotal: montoColumn("monto_total").notNull().default("0"),
    glosa: text("glosa"),
    estado: documentoCompraEstadoEnum("estado").notNull().default("borrador"),
    /** Documento de origen (p. ej. el pedido del que se trajo esta factura). */
    documentoBaseId: uuid("documento_base_id").references(
      (): AnyPgColumn => documentosCompra.id,
      { onDelete: "set null" },
    ),
    asientoId: uuid("asiento_id").references(() => asientosContables.id, { onDelete: "set null" }),
    usuarioCreacionId: uuid("usuario_creacion_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    usuarioContabilizacionId: uuid("usuario_contabilizacion_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    motivoAnulacion: text("motivo_anulacion"),
    /** Estado del documento en el Registro de Compras del SII (importación RCV). */
    estadoRcv: text("estado_rcv"),
    siiTrackId: text("sii_track_id"),
    ...timestampsColumns,
  },
  (t) => [
    index("documentos_compra_empresa_tipo_estado_idx").on(t.empresaId, t.docTipo, t.estado),
    index("documentos_compra_empresa_tercero_idx").on(t.empresaId, t.terceroId),
    uniqueIndex("documentos_compra_empresa_prov_tipo_folio_unique")
      .on(t.empresaId, t.terceroId, t.tipoDocumentoId, t.folio)
      .where(sql`${t.folio} is not null`),
  ],
);
