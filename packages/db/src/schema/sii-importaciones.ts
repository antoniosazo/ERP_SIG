import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { idColumn } from "./columns.helpers";
import { empresas } from "./empresas";

/** Bitácora de cada corrida de importación del RCV (por período y origen). */
export const siiImportaciones = pgTable("sii_importaciones", {
  id: idColumn(),
  empresaId: uuid("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  periodo: text("periodo").notNull(),
  origen: text("origen").notNull(),
  creados: integer("creados").notNull().default(0),
  existentes: integer("existentes").notNull().default(0),
  errores: integer("errores").notNull().default(0),
  detalle: jsonb("detalle"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});
