import { date, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { activoFijoEstadoEnum } from "./enums";
import { empresas } from "./empresas";
import { activosFijosClases } from "./activos-fijos-clases";
import { centrosCosto } from "./centros-costo";

/**
 * Módulo de Activo Fijo — Maestro de activos (SAP: OITM con ItemType = F). El
 * costo y la depreciación acumulada NO viven acá: se derivan de
 * `activos_fijos_documentos_lineas` (ver `activos_fijos_saldos`, una caché
 * reconstruible) — igual que el resto del sistema no permite editar saldos a mano.
 *
 * `documentoOrigenId`/`documentoOrigenTabla`: cuando el activo nace de una factura de
 * compra (línea imputada a una cuenta `tipoCuenta = "ActivoFijo"`), apunta a esa
 * factura. Polimórfico, sin FK física — mismo patrón que `asientos_contables`.
 *
 * `claseId` es opcional: un activo creado automáticamente desde una factura de compra
 * nace sin clase (el usuario la completa antes de capitalizar).
 */
export const activosFijos = pgTable(
  "activos_fijos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    descripcion: text("descripcion").notNull(),
    claseId: uuid("clase_id").references(() => activosFijosClases.id, { onDelete: "restrict" }),
    centroCostoId: uuid("centro_costo_id").references(() => centrosCosto.id, { onDelete: "restrict" }),
    estado: activoFijoEstadoEnum("estado").notNull().default("Nuevo"),
    ubicacion: text("ubicacion"),
    numeroSerie: text("numero_serie"),
    marca: text("marca"),
    modelo: text("modelo"),
    fechaAdquisicion: date("fecha_adquisicion"),
    fechaBaja: date("fecha_baja"),
    documentoOrigenId: uuid("documento_origen_id"),
    documentoOrigenTabla: text("documento_origen_tabla"),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("activos_fijos_empresa_codigo_unique").on(t.empresaId, t.codigo)],
);
