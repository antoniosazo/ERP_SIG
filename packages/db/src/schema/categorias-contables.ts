import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { categoriaAplicaAEnum, ivaRecuperableEnum } from "./enums";
import { centrosCosto } from "./centros-costo";
import { empresas } from "./empresas";
import { planCuentas } from "./plan-cuentas";

/**
 * 3.11 — Categorías contables: determinación automática de cuenta por tercero
 * (equivalente a "Grupos de Artículos" de SAP Business One, aplicado al tercero
 * en vez de al producto). Ver también el mecanismo de auto-asignación (Proceso 5).
 */
export const categoriasContables = pgTable(
  "categorias_contables",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    aplicaA: categoriaAplicaAEnum("aplica_a").notNull(),
    cuentaGastoId: uuid("cuenta_gasto_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    cuentaIngresoId: uuid("cuenta_ingreso_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    cuentaCostoId: uuid("cuenta_costo_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    cuentaActivoId: uuid("cuenta_activo_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    centroCostoDefaultId: uuid("centro_costo_default_id").references(() => centrosCosto.id, {
      onDelete: "set null",
    }),
    ivaRecuperableDefault: ivaRecuperableEnum("iva_recuperable_default"),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("categorias_contables_empresa_nombre_unique").on(t.empresaId, t.nombre)],
);
