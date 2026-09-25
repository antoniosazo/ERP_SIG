import { date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { libroContableEnum, pagoEstadoEnum } from "./enums";
import { empresas } from "./empresas";
import { usuarios } from "./usuarios";

/**
 * Cierre de ejercicio propio del módulo de Activo Fijo: una fila por (empresa, libro,
 * año). A diferencia de `cierres_ejercicio` (general), este cierre no genera su propio
 * asiento — el movimiento de dinero del año ya se contabilizó mes a mes vía los
 * documentos CAP/MEJ/DEP/baja. Cerrar es una operación administrativa: candado (exige
 * los 12 meses bloqueados y la depreciación ejecutada hasta diciembre) + fotografía
 * (congela `activos_fijos_saldos` de ese año). Se reutiliza `pago_estado`
 * (contabilizado/anulado), mismo significado que en `cierres_ejercicio`: reabrir marca
 * la fila anulada y borra los saldos congelados de ese año (vuelven a calcularse en
 * vivo), sin asiento de reversa porque el cierre nunca generó uno.
 */
export const activosFijosCierres = pgTable(
  "activos_fijos_cierres",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    libro: libroContableEnum("libro").notNull(),
    anio: integer("anio").notNull(),
    estado: pagoEstadoEnum("estado").notNull().default("contabilizado"),
    fechaReapertura: date("fecha_reapertura"),
    motivoReapertura: text("motivo_reapertura"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("activos_fijos_cierres_empresa_libro_anio_unique").on(t.empresaId, t.libro, t.anio)],
);
