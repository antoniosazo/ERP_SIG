import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { terceros } from "./terceros";

/** Contactos (personas) de un socio de negocio — OCPR de SAP B1. */
export const tercerosContactos = pgTable("terceros_contactos", {
  id: idColumn(),
  terceroId: uuid("tercero_id")
    .notNull()
    .references(() => terceros.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  apellido: text("apellido"),
  cargo: text("cargo"),
  telefono: text("telefono"),
  movil: text("movil"),
  email: text("email"),
  activo: boolean("activo").notNull().default(true),
  ...timestampsColumns,
});
