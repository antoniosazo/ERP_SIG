import { integer, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { cartolaCampoDestinoEnum } from "./enums";
import { cartolasFormatos } from "./cartolas-formatos";

/**
 * Una fila por campo semántico que mapea la plantilla (fecha, descripción, cargo, etc.)
 * a su columna (Excel/CSV, `columnaIndice` base 0) o posición (TXT ancho fijo,
 * `posicionInicio`/`posicionLargo`).
 */
export const cartolasFormatoCampos = pgTable(
  "cartolas_formato_campos",
  {
    id: idColumn(),
    formatoId: uuid("formato_id")
      .notNull()
      .references(() => cartolasFormatos.id, { onDelete: "cascade" }),
    campoDestino: cartolaCampoDestinoEnum("campo_destino").notNull(),
    columnaIndice: integer("columna_indice"),
    posicionInicio: integer("posicion_inicio"),
    posicionLargo: integer("posicion_largo"),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("cartolas_formato_campos_formato_campo_unique").on(t.formatoId, t.campoDestino)],
);
