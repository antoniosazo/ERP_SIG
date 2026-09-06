import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { direccionTipoEnum } from "./enums";
import { terceros } from "./terceros";

/** Direcciones (Facturación / Despacho) de un socio de negocio — CRD1 de SAP B1. */
export const tercerosDirecciones = pgTable("terceros_direcciones", {
  id: idColumn(),
  terceroId: uuid("tercero_id")
    .notNull()
    .references(() => terceros.id, { onDelete: "cascade" }),
  tipo: direccionTipoEnum("tipo").notNull(),
  nombre: text("nombre"),
  calle: text("calle"),
  numero: text("numero"),
  comuna: text("comuna"),
  ciudad: text("ciudad"),
  region: text("region"),
  pais: text("pais").notNull().default("Chile"),
  codigoPostal: text("codigo_postal"),
  esPrincipal: boolean("es_principal").notNull().default(false),
  ...timestampsColumns,
});
