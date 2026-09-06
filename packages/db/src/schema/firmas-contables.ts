import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { firmaEstadoEnum, planContratadoEnum } from "./enums";

/** 3.0 — Firma contable: nivel superior del sistema, el cliente real del software. */
export const firmasContables = pgTable(
  "firmas_contables",
  {
    id: idColumn(),
    rut: text("rut").notNull(),
    razonSocial: text("razon_social").notNull(),
    planContratado: planContratadoEnum("plan_contratado").notNull().default("Basico"),
    estado: firmaEstadoEnum("estado").notNull().default("Activa"),
    ...timestampsColumns,
  },
  (t) => [unique("firmas_contables_rut_unique").on(t.rut)],
);
