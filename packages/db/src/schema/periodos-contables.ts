import { date, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { periodoEstadoEnum } from "./enums";
import { empresas } from "./empresas";
import { usuarios } from "./usuarios";

/**
 * 3.12 — Periodos contables. Cada empresa cierra sus periodos de forma independiente
 * y secuencial. `estado` es el "Status del período" estilo SAP Business One
 * (Desbloqueado / Período de cierre / Bloqueado / Bloqueado excepto ventas).
 * `fechaInicio`/`fechaFin` = rango de "Fecha de contabilización" de SAP.
 * `usuarioCierreId` / `fechaCierre` / `motivoReapertura` son el rastro de cierre y
 * reapertura mientras `bitacora_auditoria` (3.8) no exista como tabla.
 */
export const periodosContables = pgTable(
  "periodos_contables",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),
    fechaInicio: date("fecha_inicio").notNull(),
    fechaFin: date("fecha_fin").notNull(),
    // Un periodo nace "Bloqueado": se abre explícitamente cuando el contador va a
    // trabajar ese mes (igual que en SAP B1). `fechaCierre` distingue un periodo
    // recién generado de uno que se cerró de verdad (ver cambiarEstadoPeriodo).
    estado: periodoEstadoEnum("estado").notNull().default("Bloqueado"),
    fechaCierre: timestamp("fecha_cierre", { withTimezone: true }),
    usuarioCierreId: uuid("usuario_cierre_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    motivoReapertura: text("motivo_reapertura"),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("periodos_contables_empresa_anio_mes_unique").on(t.empresaId, t.anio, t.mes)],
);
