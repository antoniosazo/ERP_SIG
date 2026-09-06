import { integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { serieAmbitoEnum } from "./enums";
import { empresas } from "./empresas";

/**
 * Series de numeración correlativa reutilizables (patrón SAP B1). Por ahora solo el
 * `ambito = "tercero"` (CardCode por tipo de socio: `CL-00001`, `PR-00001`, …); a futuro
 * se reutiliza para facturas / órdenes de compra. El correlativo se toma con `FOR UPDATE`
 * dentro de la transacción de alta — ver `queries/series.ts`.
 */
export const seriesNumeracion = pgTable(
  "series_numeracion",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    ambito: serieAmbitoEnum("ambito").notNull(),
    clave: text("clave").notNull(),
    prefijo: text("prefijo").notNull().default(""),
    proximo: integer("proximo").notNull().default(1),
    digitos: integer("digitos").notNull().default(5),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("series_numeracion_empresa_ambito_clave_unique").on(
      t.empresaId,
      t.ambito,
      t.clave,
    ),
  ],
);
