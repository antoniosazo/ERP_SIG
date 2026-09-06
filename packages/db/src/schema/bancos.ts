import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";

/** 3.7 — Bancos e instituciones financieras. Tabla global. `cuentas_bancarias` queda fuera de esta fase. */
export const bancos = pgTable(
  "bancos",
  {
    id: idColumn(),
    nombre: text("nombre").notNull(),
    codigoSbif: text("codigo_sbif"),
    ...timestampsColumns,
  },
  (t) => [unique("bancos_nombre_unique").on(t.nombre)],
);
