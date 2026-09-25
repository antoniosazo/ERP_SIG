import { boolean, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { empresas } from "./empresas";

/**
 * Tabla de vidas útiles del SII (Resolución Ex. N°43/2002 y sus actualizaciones),
 * consultada al configurar una valoración tributaria — mismo patrón que
 * `plan_cuentas_plantillas`: `empresaId` nulo = fila global (plantilla, sembrada con un
 * subconjunto representativo de categorías comunes); con `empresaId` = categoría propia
 * que la firma agrega. Sin FK desde `activos_fijos_valoraciones`: es una consulta de
 * apoyo que autocompleta `vidaUtilNormalMeses`, no una integridad referencial dura (la
 * tabla oficial cambia y no se transcribe completa).
 */
export const activosFijosVidasUtilesSii = pgTable(
  "activos_fijos_vidas_utiles_sii",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    categoria: text("categoria").notNull(),
    descripcion: text("descripcion"),
    vidaUtilNormalMeses: integer("vida_util_normal_meses").notNull(),
    activa: boolean("activa").notNull().default(true),
    ...timestampsColumns,
  },
  (t) => [
    // Índices parciales (no un único compuesto): NULL nunca es igual a NULL en un índice
    // único normal, así que sin el `where` dos filas globales con la misma categoría no
    // chocarían — mismo problema y misma solución que ya usa `plan_cuentas` para
    // empresaId/plantillaId.
    uniqueIndex("activos_fijos_vidas_utiles_sii_global_categoria_unique")
      .on(t.categoria)
      .where(sql`${t.empresaId} is null`),
    uniqueIndex("activos_fijos_vidas_utiles_sii_empresa_categoria_unique")
      .on(t.empresaId, t.categoria)
      .where(sql`${t.empresaId} is not null`),
  ],
);
