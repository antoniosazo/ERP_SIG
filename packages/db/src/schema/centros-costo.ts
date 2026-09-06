import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { empresas } from "./empresas";

/** 3.3 — Centros de costo, jerárquicos por empresa. */
export const centrosCosto = pgTable(
  "centros_costo",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    centroPadreId: uuid("centro_padre_id").references((): AnyPgColumn => centrosCosto.id, {
      onDelete: "restrict",
    }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    estado: text("estado").notNull().default("Activo"),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("centros_costo_empresa_codigo_unique").on(t.empresaId, t.codigo)],
);
