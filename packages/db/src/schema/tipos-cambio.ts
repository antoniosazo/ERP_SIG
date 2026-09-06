import { date, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { tipoCambioColumn, timestampsColumns } from "./columns.helpers";
import { tipoCambioOrigenEnum } from "./enums";
import { monedas } from "./monedas";

/**
 * 3.9 — Histórico de valores de cada moneda por fecha (`valor_en_clp` = cuánto vale
 * 1 unidad de esa moneda en CLP). Como las monedas son por empresa, los tipos de cambio
 * también lo son vía `moneda_id`. `onDelete: cascade`: el histórico no tiene sentido
 * sin la moneda, y la moneda ya se puede eliminar desde su maestro.
 */
export const tiposCambio = pgTable(
  "tipos_cambio",
  {
    fecha: date("fecha").notNull(),
    monedaId: uuid("moneda_id")
      .notNull()
      .references(() => monedas.id, { onDelete: "cascade" }),
    valorEnClp: tipoCambioColumn("valor_en_clp").notNull(),
    origen: tipoCambioOrigenEnum("origen").notNull().default("Manual"),
    ...timestampsColumns,
  },
  (t) => [primaryKey({ columns: [t.fecha, t.monedaId] })],
);
