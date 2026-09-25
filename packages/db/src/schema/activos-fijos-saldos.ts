import { integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { montoColumn, timestampsColumns } from "./columns.helpers";
import { libroContableEnum } from "./enums";
import { activosFijos } from "./activos-fijos";

/**
 * Saldos acumulados por (activo, libro, año) — SAP: ITM8. Caché reconstruible desde
 * `activos_fijos_documentos_lineas`; nunca se escribe a mano (mismo principio que ya
 * aplica el resto del sistema a sus cachés de saldo).
 */
export const activosFijosSaldos = pgTable(
  "activos_fijos_saldos",
  {
    activoId: uuid("activo_id")
      .notNull()
      .references(() => activosFijos.id, { onDelete: "cascade" }),
    libro: libroContableEnum("libro").notNull(),
    anio: integer("anio").notNull(),
    costoInicial: montoColumn("costo_inicial").notNull().default("0"),
    altas: montoColumn("altas").notNull().default("0"),
    bajas: montoColumn("bajas").notNull().default("0"),
    costoFinal: montoColumn("costo_final").notNull().default("0"),
    depAcumuladaInicial: montoColumn("dep_acumulada_inicial").notNull().default("0"),
    depEjercicio: montoColumn("dep_ejercicio").notNull().default("0"),
    depBajas: montoColumn("dep_bajas").notNull().default("0"),
    depAcumuladaFinal: montoColumn("dep_acumulada_final").notNull().default("0"),
    valorLibro: montoColumn("valor_libro").notNull().default("0"),
    ...timestampsColumns,
  },
  (t) => [primaryKey({ columns: [t.activoId, t.libro, t.anio] })],
);
