import { boolean, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { activoFijoTipoEnum } from "./enums";
import { empresas } from "./empresas";

/**
 * Módulo de Activo Fijo, Fase 1 — Clases de activo (SAP: OACS). Agrupa activos para
 * reportes y define, junto con `activos_fijos_clases_cuentas`, qué cuentas contables le
 * corresponden por libro (ver decisión de diseño 4 del plan: mismo patrón que
 * `productos_grupos`, no el motor genérico de `reglas_determinacion_cuenta`).
 */
export const activosFijosClases = pgTable(
  "activos_fijos_clases",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    tipoActivo: activoFijoTipoEnum("tipo_activo").notNull().default("Tangible"),
    numeracionSerie: text("numeracion_serie"),
    activa: boolean("activa").notNull().default(true),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("activos_fijos_clases_empresa_codigo_unique").on(t.empresaId, t.codigo)],
);
