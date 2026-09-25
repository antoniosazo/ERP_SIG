import { date, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { cartolaMovimientoEstadoEnum } from "./enums";
import { cartolas } from "./cartolas";
import { cuentasBancarias } from "./cuentas-bancarias";

/**
 * Un movimiento de cartola. `monto` viene con signo (abono positivo, cargo negativo).
 * `cuentaBancariaId` está denormalizado desde `cartolas` porque la huella de
 * deduplicación debe ser única por cuenta a través de todas las cartolas importadas, no
 * solo dentro de una — así se pueden subir cartolas con días traslapados sin duplicar.
 */
export const cartolasMovimientos = pgTable(
  "cartolas_movimientos",
  {
    id: idColumn(),
    cartolaId: uuid("cartola_id")
      .notNull()
      .references(() => cartolas.id, { onDelete: "cascade" }),
    cuentaBancariaId: uuid("cuenta_bancaria_id")
      .notNull()
      .references(() => cuentasBancarias.id, { onDelete: "restrict" }),
    fecha: date("fecha").notNull(),
    descripcion: text("descripcion").notNull(),
    nroDocumento: text("nro_documento"),
    rutContraparte: text("rut_contraparte"),
    monto: montoColumn("monto").notNull(),
    codigoTransaccion: text("codigo_transaccion"),
    huella: text("huella").notNull(),
    estadoConciliacion: cartolaMovimientoEstadoEnum("estado_conciliacion").notNull().default("Pendiente"),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("cartolas_movimientos_cuenta_huella_unique").on(t.cuentaBancariaId, t.huella)],
);
