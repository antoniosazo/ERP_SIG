import { date, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, montoColumn } from "./columns.helpers";
import { empresas } from "./empresas";

/**
 * Bandeja previa a la carga: DTE bajados del SII (XML del Sistema de Facturación
 * Gratuita) que esperan validación antes de convertirse en un documento de compra o
 * venta en borrador. `datos` guarda el DTE parseado (líneas y referencias incluidas).
 * `estado`: pendiente → cargado (con `documentoId`) o descartado.
 */
export const siiDtesPendientes = pgTable(
  "sii_dtes_pendientes",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    origen: text("origen").notNull(),
    tipoDte: integer("tipo_dte").notNull(),
    folio: text("folio").notNull(),
    rutContraparte: text("rut_contraparte").notNull(),
    razonSocialContraparte: text("razon_social_contraparte"),
    fechaEmision: date("fecha_emision").notNull(),
    montoNeto: montoColumn("monto_neto").notNull().default("0"),
    montoExento: montoColumn("monto_exento").notNull().default("0"),
    montoIva: montoColumn("monto_iva").notNull().default("0"),
    montoTotal: montoColumn("monto_total").notNull().default("0"),
    datos: jsonb("datos").notNull(),
    estado: text("estado").notNull().default("pendiente"),
    documentoId: uuid("documento_id"),
    error: text("error"),
    descargadoEn: timestamp("descargado_en", { withTimezone: true }).notNull().defaultNow(),
    resueltoEn: timestamp("resuelto_en", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sii_dtes_pendientes_unico").on(
      t.empresaId,
      t.origen,
      t.tipoDte,
      t.folio,
      t.rutContraparte,
    ),
  ],
);
