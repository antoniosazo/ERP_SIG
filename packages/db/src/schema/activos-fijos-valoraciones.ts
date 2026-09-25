import { boolean, date, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { montoColumn, timestampsColumns } from "./columns.helpers";
import {
  activoFijoMetodoDepEnum,
  activoFijoReglaBajaEnum,
  activoFijoReglaInicioEnum,
  libroContableEnum,
} from "./enums";
import { activosFijos } from "./activos-fijos";

/**
 * Parámetros de depreciación de un activo por libro (SAP: ITM7) — un activo tiene una
 * fila por libro en el que se valoriza (Fase 1: Tributario e IFRS). La Fase 1 del motor
 * solo calcula `metodoDep = "Lineal"`; los demás valores del enum están declarados para
 * no migrar el esquema cuando se implementen (ver plan, adaptación 5).
 */
export const activosFijosValoraciones = pgTable(
  "activos_fijos_valoraciones",
  {
    activoId: uuid("activo_id")
      .notNull()
      .references(() => activosFijos.id, { onDelete: "cascade" }),
    libro: libroContableEnum("libro").notNull(),
    metodoDep: activoFijoMetodoDepEnum("metodo_dep").notNull().default("Lineal"),
    reglaInicio: activoFijoReglaInicioEnum("regla_inicio").notNull().default("Mes siguiente"),
    reglaBaja: activoFijoReglaBajaEnum("regla_baja").notNull().default("Hasta mes anterior"),
    fechaInicioDep: date("fecha_inicio_dep"),
    vidaUtilMeses: integer("vida_util_meses").notNull(),
    valorResidual: montoColumn("valor_residual").notNull().default("0"),
    bloqueado: boolean("bloqueado").notNull().default(false),
    ...timestampsColumns,
  },
  (t) => [primaryKey({ columns: [t.activoId, t.libro] })],
);
