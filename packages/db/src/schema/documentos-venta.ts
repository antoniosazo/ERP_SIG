import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { date, index, integer, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { documentoModalidadEnum, documentoVentaClaseEnum, documentoVentaEstadoEnum } from "./enums";
import { asientosContables } from "./asientos-contables";
import { empresas } from "./empresas";
import { monedas } from "./monedas";
import { terceros } from "./terceros";
import { tercerosContactos } from "./terceros-contactos";
import { tiposDocumento } from "./tipos-documento";
import { usuarios } from "./usuarios";

/**
 * 4.2 — Documento tributario de venta (Factura / Nota de Crédito / Nota de Débito).
 * `numeroInterno` = correlativo de la serie `venta`; `folio` = folio del SII (lo tipea
 * el usuario). Al contabilizar se genera el asiento (`asientoId`) y `estado` pasa a
 * `contabilizado`. NC/ND referencian el documento que corrigen (`documentoReferenciaId`).
 */
export const documentosVenta = pgTable(
  "documentos_venta",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    numeroInterno: text("numero_interno"),
    clase: documentoVentaClaseEnum("clase").notNull(),
    modalidad: documentoModalidadEnum("modalidad").notNull().default("Artículo"),
    tipoDocumentoId: uuid("tipo_documento_id")
      .notNull()
      .references(() => tiposDocumento.id, { onDelete: "restrict" }),
    terceroId: uuid("tercero_id")
      .notNull()
      .references(() => terceros.id, { onDelete: "restrict" }),
    folio: text("folio"),
    fechaEmision: date("fecha_emision").notNull(),
    fechaVencimiento: date("fecha_vencimiento"),
    numAtCard: text("num_at_card"),
    monedaId: uuid("moneda_id")
      .notNull()
      .references(() => monedas.id, { onDelete: "restrict" }),
    tipoCambio: numeric("tipo_cambio", { precision: 18, scale: 6 }).notNull().default("1"),
    descuentoGlobalPct: numeric("descuento_global_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    // Datos comerciales opcionales (SAP: CardName, PayTerms, SalesPerson, Contact, Address).
    nombreCliente: text("nombre_cliente"),
    condicionPagoDias: integer("condicion_pago_dias"),
    vendedorId: uuid("vendedor_id").references(() => usuarios.id, { onDelete: "set null" }),
    contactoId: uuid("contacto_id").references(() => tercerosContactos.id, { onDelete: "set null" }),
    direccionFacturacion: text("direccion_facturacion"),
    direccionDespacho: text("direccion_despacho"),
    montoNeto: montoColumn("monto_neto").notNull().default("0"),
    montoExento: montoColumn("monto_exento").notNull().default("0"),
    montoImpuesto: montoColumn("monto_impuesto").notNull().default("0"),
    montoTotal: montoColumn("monto_total").notNull().default("0"),
    glosa: text("glosa"),
    estado: documentoVentaEstadoEnum("estado").notNull().default("borrador"),
    documentoReferenciaId: uuid("documento_referencia_id").references(
      (): AnyPgColumn => documentosVenta.id,
      { onDelete: "set null" },
    ),
    asientoId: uuid("asiento_id").references(() => asientosContables.id, { onDelete: "set null" }),
    /** Fecha contable: define la fecha del asiento y el periodo que se valida. Editable en borrador. */
    fechaContabilizacion: date("fecha_contabilizacion"),
    usuarioContabilizacionId: uuid("usuario_contabilizacion_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    usuarioCreacionId: uuid("usuario_creacion_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    motivoAnulacion: text("motivo_anulacion"),
    /** Estado del documento en el Registro de Ventas del SII (importación RCV). */
    estadoRcv: text("estado_rcv"),
    ...timestampsColumns,
  },
  (t) => [
    index("documentos_venta_empresa_estado_idx").on(t.empresaId, t.estado),
    index("documentos_venta_empresa_tercero_idx").on(t.empresaId, t.terceroId),
    uniqueIndex("documentos_venta_empresa_tipo_folio_unique")
      .on(t.empresaId, t.tipoDocumentoId, t.folio)
      .where(sql`${t.folio} is not null`),
  ],
);
