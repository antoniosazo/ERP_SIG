import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { montoColumn, timestampsColumns } from "./columns.helpers";
import { libroContableEnum } from "./enums";
import { activosFijos } from "./activos-fijos";
import { periodosContables } from "./periodos-contables";

/**
 * Valores de depreciación por (activo, libro, período) — SAP: ODPV. `periodoId` es un FK
 * directo a `periodos_contables`, no un par año/mes duplicado: el calendario de Activo
 * Fijo es el mismo que el de toda la empresa.
 */
export const activosFijosValoresPeriodo = pgTable(
  "activos_fijos_valores_periodo",
  {
    activoId: uuid("activo_id")
      .notNull()
      .references(() => activosFijos.id, { onDelete: "cascade" }),
    libro: libroContableEnum("libro").notNull(),
    periodoId: uuid("periodo_id")
      .notNull()
      .references(() => periodosContables.id, { onDelete: "restrict" }),
    depPlanificada: montoColumn("dep_planificada").notNull().default("0"),
    depContabilizada: montoColumn("dep_contabilizada").notNull().default("0"),
    ...timestampsColumns,
  },
  (t) => [primaryKey({ columns: [t.activoId, t.libro, t.periodoId] })],
);
