import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, montoColumn, timestampsColumns, tipoCambioColumn } from "./columns.helpers";
import { asientosContables } from "./asientos-contables";
import { centrosCosto } from "./centros-costo";
import { monedas } from "./monedas";
import { planCuentas } from "./plan-cuentas";
import { terceros } from "./terceros";

/**
 * 4.1 / ERD sección 3 — Líneas de asiento. Multi-moneda desde el día 1: cada línea
 * registra el monto en moneda origen y su equivalente en moneda funcional (2.3).
 * La cuadratura debe=haber por asiento se valida en la capa de aplicación, no en DB
 * (ver decisión de diseño 6 del plan).
 */
export const asientosLineas = pgTable("asientos_lineas", {
  id: idColumn(),
  asientoId: uuid("asiento_id")
    .notNull()
    .references(() => asientosContables.id, { onDelete: "cascade" }),
  cuentaId: uuid("cuenta_id")
    .notNull()
    .references(() => planCuentas.id, { onDelete: "restrict" }),
  centroCostoId: uuid("centro_costo_id").references(() => centrosCosto.id, {
    onDelete: "restrict",
  }),
  terceroId: uuid("tercero_id").references(() => terceros.id, { onDelete: "restrict" }),
  glosa: text("glosa"),
  montoDebeOrigen: montoColumn("monto_debe_origen").notNull().default("0"),
  montoHaberOrigen: montoColumn("monto_haber_origen").notNull().default("0"),
  monedaOrigenId: uuid("moneda_origen_id")
    .notNull()
    .references(() => monedas.id, { onDelete: "restrict" }),
  tipoCambioAplicado: tipoCambioColumn("tipo_cambio_aplicado"),
  montoDebeFuncional: montoColumn("monto_debe_funcional").notNull().default("0"),
  montoHaberFuncional: montoColumn("monto_haber_funcional").notNull().default("0"),
  documentoReferenciaId: uuid("documento_referencia_id"),
  ...timestampsColumns,
});
