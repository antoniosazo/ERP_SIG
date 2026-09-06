import { boolean, pgTable, text, unique } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { tipoOperacionDocumentoEnum } from "./enums";

/** 3.4 — Documentos mercantiles/tributarios del SII. Tabla global, normalmente de solo lectura. */
export const tiposDocumento = pgTable(
  "tipos_documento",
  {
    id: idColumn(),
    codigoSii: text("codigo_sii").notNull(),
    nombre: text("nombre").notNull(),
    tipoOperacion: tipoOperacionDocumentoEnum("tipo_operacion").notNull(),
    afectoIva: boolean("afecto_iva").notNull().default(true),
    documentoRelacionable: boolean("documento_relacionable").notNull().default(false),
    ...timestampsColumns,
  },
  (t) => [unique("tipos_documento_codigo_sii_unique").on(t.codigoSii)],
);
