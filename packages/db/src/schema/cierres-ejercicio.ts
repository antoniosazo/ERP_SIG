import { date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { pagoEstadoEnum } from "./enums";
import { asientosContables } from "./asientos-contables";
import { empresas } from "./empresas";
import { planCuentas } from "./plan-cuentas";
import { usuarios } from "./usuarios";

/**
 * Cierre de ejercicio: una fila por (empresa, año). Al cerrar, el asiento generado
 * deja en cero las cuentas de Ingresos/Costos y Gastos del año y traspasa el neto a
 * `cuentaResultadoId` (una cuenta de Patrimonio, ej. "Resultado del Ejercicio").
 * Se reutiliza `pago_estado` (contabilizado/anulado): mismo significado — reabrir
 * genera un asiento de reversa y no borra el histórico. Solo hay un cierre "vigente"
 * por año; reabrir + volver a cerrar reemplaza el asiento (y el reversa) de esta fila.
 */
export const cierresEjercicio = pgTable(
  "cierres_ejercicio",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    anio: integer("anio").notNull(),
    cuentaResultadoId: uuid("cuenta_resultado_id")
      .notNull()
      .references(() => planCuentas.id, { onDelete: "restrict" }),
    montoResultado: montoColumn("monto_resultado").notNull(),
    estado: pagoEstadoEnum("estado").notNull().default("contabilizado"),
    asientoId: uuid("asiento_id").references(() => asientosContables.id, { onDelete: "set null" }),
    asientoReversaId: uuid("asiento_reversa_id").references(() => asientosContables.id, { onDelete: "set null" }),
    fechaReapertura: date("fecha_reapertura"),
    motivoReapertura: text("motivo_reapertura"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("cierres_ejercicio_empresa_anio_unique").on(t.empresaId, t.anio)],
);
