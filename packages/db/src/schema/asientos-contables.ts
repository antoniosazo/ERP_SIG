import { date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { asientoEstadoEnum, asientoTipoEnum, libroContableEnum } from "./enums";
import { empresas } from "./empresas";

/**
 * 4.1 / ERD sección 3 — Núcleo contable: asientos. `libro` se agrega desde el día 1
 * con default 'Ambos' aunque IFRS no se use todavía (recomendación explícita de la
 * sección 9 del diseño técnico y de las notas de implementación del ERD).
 *
 * `documentoOrigenId` / `documentoOrigenTabla`: referencia polimórfica hacia el
 * documento que generó el asiento automático. Sin FK física (las tablas de documento
 * origen — compras, ventas, honorarios — no existen todavía en esta fase); ver
 * decisión de diseño 4 del plan y la nota de implementación del ERD.
 */
export const asientosContables = pgTable(
  "asientos_contables",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    correlativo: integer("correlativo").notNull(),
    anio: integer("anio")
      .notNull()
      .generatedAlwaysAs(sql`EXTRACT(YEAR FROM fecha)::int`),
    fecha: date("fecha").notNull(),
    glosa: text("glosa").notNull(),
    tipo: asientoTipoEnum("tipo").notNull(),
    origen: text("origen"),
    libro: libroContableEnum("libro").notNull().default("Ambos"),
    estado: asientoEstadoEnum("estado").notNull().default("borrador"),
    documentoOrigenId: uuid("documento_origen_id"),
    documentoOrigenTabla: text("documento_origen_tabla"),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("asientos_contables_empresa_anio_correlativo_unique").on(
      t.empresaId,
      t.anio,
      t.correlativo,
    ),
  ],
);
