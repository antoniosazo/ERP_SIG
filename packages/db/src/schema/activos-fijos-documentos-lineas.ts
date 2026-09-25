import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { libroContableEnum } from "./enums";
import { activosFijosDocumentos } from "./activos-fijos-documentos";
import { activosFijos } from "./activos-fijos";

/** Líneas de documento (SAP: ACQ1) — una fila por activo afectado y libro. */
export const activosFijosDocumentosLineas = pgTable("activos_fijos_documentos_lineas", {
  id: idColumn(),
  documentoId: uuid("documento_id")
    .notNull()
    .references(() => activosFijosDocumentos.id, { onDelete: "cascade" }),
  numeroLinea: integer("numero_linea").notNull(),
  activoId: uuid("activo_id")
    .notNull()
    .references(() => activosFijos.id, { onDelete: "restrict" }),
  libro: libroContableEnum("libro").notNull(),
  importe: montoColumn("importe").notNull(),
  /** Ajuste de depreciación acumulada asociado a la línea, aparte del ajuste de costo
   * (`importe`): en bajas (BAJA_VTA/BAJA_CAST) es la porción retirada junto con el costo
   * (se resta); en corrección monetaria (CM) es el reajuste de la dep. acumulada (se
   * suma) — permite reconstruir el saldo sin tocar `importe`. */
  depAcumuladaRetirada: montoColumn("dep_acumulada_retirada").notNull().default("0"),
  glosa: text("glosa"),
  ...timestampsColumns,
});
