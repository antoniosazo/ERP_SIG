import { boolean, date, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { montoColumn, timestampsColumns } from "./columns.helpers";
import {
  activoFijoMetodoDepEnum,
  activoFijoRegimenDepreciacionEnum,
  activoFijoReglaBajaEnum,
  activoFijoReglaInicioEnum,
  libroContableEnum,
} from "./enums";
import { activosFijos } from "./activos-fijos";

/**
 * Parámetros de depreciación de un activo por libro (SAP: ITM7) — un activo tiene una
 * fila por libro en el que se valoriza (Tributario e IFRS). El motor calcula
 * `metodoDep = "Lineal"` (Fase 1) e `"Inmediata"` (Fase 3); el resto del enum queda
 * declarado para no migrar el esquema cuando se implemente.
 *
 * `regimenDepreciacion` (Fase 3) solo tiene sentido en `libro = "Tributario"`:
 * "Acelerada" usa `metodoDep = "Lineal"` con `vidaUtilMeses` ya dividida por 3 (guardada
 * en `vidaUtilNormalMeses` la vida útil SII original, para poder calcular el DDAN);
 * "Instantanea" usa `metodoDep = "Inmediata"`.
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
    regimenDepreciacion: activoFijoRegimenDepreciacionEnum("regimen_depreciacion").notNull().default("Normal"),
    vidaUtilNormalMeses: integer("vida_util_normal_meses"),
    ...timestampsColumns,
  },
  (t) => [primaryKey({ columns: [t.activoId, t.libro] })],
);
