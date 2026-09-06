import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { usuarios } from "./usuarios";

/**
 * Preferencias de UI por usuario para un formulario (orden y visibilidad de campos).
 * Genérica: `clave` identifica el formulario (v1: `"documento_venta"`). `config` es
 * `{ cabecera: { orden, ocultos }, linea: { orden, ocultos } }` (ver `configFormularioDocSchema`).
 * No se audita — es preferencia personal, no dato de negocio.
 */
export const preferenciasFormulario = pgTable(
  "preferencias_formulario",
  {
    id: idColumn(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    clave: text("clave").notNull(),
    config: jsonb("config").notNull().default({}),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("preferencias_formulario_usuario_clave_unique").on(t.usuarioId, t.clave)],
);
