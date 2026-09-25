import { integer, numeric, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";

/**
 * Factores mensuales de corrección monetaria (variación IPC) publicados por el SII —
 * globales, no por empresa: el IPC es el mismo para todas las empresas chilenas. La
 * firma los carga a mano cada mes (no se scrapea el sitio del SII). `factorPorcentaje`
 * es el porcentaje de actualización que corresponde aplicar a un bien adquirido en ese
 * mes; si el SII publica un valor negativo, se guarda igual, pero `aplicarCorreccionMonetaria`
 * lo trata como 0 (el ajuste nunca reduce el activo, regla del art. 41 LIR).
 */
export const factoresCorreccionMonetaria = pgTable(
  "factores_correccion_monetaria",
  {
    id: idColumn(),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),
    factorPorcentaje: numeric("factor_porcentaje", { precision: 8, scale: 4 }).notNull(),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("factores_correccion_monetaria_anio_mes_unique").on(t.anio, t.mes)],
);
