import { date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { activoFijoDocEstadoEnum, activoFijoDocTipoEnum, libroContableEnum } from "./enums";
import { empresas } from "./empresas";
import { asientosContables } from "./asientos-contables";
import { usuarios } from "./usuarios";

/**
 * Módulo de Activo Fijo — Documento único para todo movimiento (SAP: OACQ), igual
 * que ya se decidió para `documentos_compra`/`asientos_contables`: un solo esquema para
 * capitalización, mejoras, depreciación, bajas, transferencias y apertura simplifica el
 * motor, la anulación y los informes. `libro` nulo = afecta todos los libros del activo
 * (ej. una capitalización); con valor = afecta solo ese libro (ej. una depreciación
 * tributaria).
 *
 * Anulación (Fase 2): mismo patrón que `documentos_compra`/`documentos_venta`/`pagos` —
 * reversa contable (nuevo asiento, debe/haber invertidos) + `estado: "anulado"` +
 * `motivoAnulacion` + `asientoReversaId`. No hay self-FK "doc anulado": la reversa se
 * encuentra por `asientoReversaId`, igual que en pagos/cheques/cierres de ejercicio.
 */
export const activosFijosDocumentos = pgTable(
  "activos_fijos_documentos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "restrict" }),
    numero: integer("numero").notNull(),
    anio: integer("anio").notNull(),
    tipoDoc: activoFijoDocTipoEnum("tipo_doc").notNull(),
    estado: activoFijoDocEstadoEnum("estado").notNull().default("borrador"),
    libro: libroContableEnum("libro"),
    fecha: date("fecha").notNull(),
    fechaContabilizacion: date("fecha_contabilizacion"),
    glosa: text("glosa"),
    asientoId: uuid("asiento_id").references(() => asientosContables.id, { onDelete: "set null" }),
    motivoAnulacion: text("motivo_anulacion"),
    asientoReversaId: uuid("asiento_reversa_id").references(() => asientosContables.id, { onDelete: "set null" }),
    usuarioCreacionId: uuid("usuario_creacion_id").references(() => usuarios.id, { onDelete: "set null" }),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("activos_fijos_documentos_empresa_tipo_anio_numero_unique").on(
      t.empresaId,
      t.tipoDoc,
      t.anio,
      t.numero,
    ),
  ],
);
