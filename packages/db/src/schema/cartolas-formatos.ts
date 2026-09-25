import { boolean, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampsColumns } from "./columns.helpers";
import {
  cartolaCodificacionEnum,
  cartolaFormatoFechaEnum,
  cartolaFormatoNumeroEnum,
  cartolaReglaSignoEnum,
  cartolaTipoArchivoEnum,
} from "./enums";
import { bancos } from "./bancos";
import { empresas } from "./empresas";

/**
 * Plantilla de mapeo de cartola por banco (sección 5.2 de la especificación) — mismo
 * patrón de dos niveles que `activos_fijos_vidas_utiles_sii`: `empresaId` nulo = plantilla
 * global del banco, con valor = propia de esa empresa. Solo la global es única por banco
 * (índice parcial: en Postgres NULL no deduplica un índice único normal); una empresa
 * puede tener varias por banco porque el formato cambia a veces por producto (portal
 * Excel vs. TXT de cash management).
 */
export const cartolasFormatos = pgTable(
  "cartolas_formatos",
  {
    id: idColumn(),
    bancoId: uuid("banco_id")
      .notNull()
      .references(() => bancos.id, { onDelete: "restrict" }),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    tipoArchivo: cartolaTipoArchivoEnum("tipo_archivo").notNull(),
    codificacion: cartolaCodificacionEnum("codificacion").notNull().default("UTF-8"),
    separador: text("separador"),
    filasOmitirInicio: integer("filas_omitir_inicio").notNull().default(0),
    filasOmitirFin: integer("filas_omitir_fin").notNull().default(0),
    formatoFecha: cartolaFormatoFechaEnum("formato_fecha").notNull(),
    formatoNumero: cartolaFormatoNumeroEnum("formato_numero").notNull(),
    reglaSigno: cartolaReglaSignoEnum("regla_signo").notNull(),
    activo: boolean("activo").notNull().default(true),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("cartolas_formatos_global_banco_unique")
      .on(t.bancoId)
      .where(sql`${t.empresaId} is null`),
  ],
);
