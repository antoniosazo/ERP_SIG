import { numeric, timestamp, uuid } from "drizzle-orm/pg-core";

export const idColumn = () => uuid("id").defaultRandom().primaryKey();

export const timestampsColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Montos contables: `numeric` explícito con precisión/escala fija, nunca float/double
 * (ver sección 8.3 del diseño técnico). 18 dígitos totales, 4 decimales — suficiente
 * para CLP y USD; UF se maneja con más decimales vía `tipoCambioColumn`.
 */
export const montoColumn = (name: string) => numeric(name, { precision: 18, scale: 4 });

/** Valores de tipo de cambio / UF: más decimales que un monto normal. */
export const tipoCambioColumn = (name: string) => numeric(name, { precision: 18, scale: 6 });
