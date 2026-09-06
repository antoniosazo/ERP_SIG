import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { empresas } from "./empresas";

/** Grupos de socios de negocio (segmentación / reportería) — catálogo por empresa. */
export const tercerosGrupos = pgTable(
  "terceros_grupos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("terceros_grupos_empresa_codigo_unique").on(t.empresaId, t.codigo)],
);
