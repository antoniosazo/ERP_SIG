import { boolean, date, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { empresaEstadoEnum } from "./enums";
import { firmasContables } from "./firmas-contables";
import { monedas } from "./monedas";
import { planCuentasPlantillas } from "./plan-cuentas-plantillas";

/** 3.1 — Empresas cliente de la firma contable. */
export const empresas = pgTable(
  "empresas",
  {
    id: idColumn(),
    firmaContableId: uuid("firma_contable_id")
      .notNull()
      .references(() => firmasContables.id, { onDelete: "restrict" }),
    rut: text("rut").notNull(),
    razonSocial: text("razon_social").notNull(),
    giro: text("giro").notNull(),
    direccion: text("direccion"),
    regimenTributario: text("regimen_tributario").notNull(),
    fechaInicioActividades: date("fecha_inicio_actividades"),
    monedaFuncionalId: uuid("moneda_funcional_id")
      .notNull()
      .references(() => monedas.id, { onDelete: "restrict" }),
    monedaReporteId: uuid("moneda_reporte_id").references(() => monedas.id, {
      onDelete: "restrict",
    }),
    permiteMultimoneda: boolean("permite_multimoneda").notNull().default(false),
    aplicaIfrs: boolean("aplica_ifrs").notNull().default(false),
    planCuentasPlantillaId: uuid("plan_cuentas_plantilla_id")
      .notNull()
      .references(() => planCuentasPlantillas.id, { onDelete: "restrict" }),
    fechaPrimerPeriodoContable: date("fecha_primer_periodo_contable").notNull(),
    // contadorAsignadoId (FK a usuarios) queda pendiente hasta el módulo de Usuarios y Roles.
    estado: empresaEstadoEnum("estado").notNull().default("Activa"),
    // Configuración de "Visualización" (equivalente a la pestaña de Configuración
    // general de SAP B1). Los separadores se guardan como texto por el valor " "/"".
    // Los decimales de un monto salen de `monedas.decimales` (cada moneda tiene los
    // suyos); aquí solo va lo que no está expresado en una moneda: el tipo de cambio.
    separadorDecimal: text("separador_decimal").notNull().default(","),
    separadorMiles: text("separador_miles").notNull().default("."),
    decimalesTipoCambio: integer("decimales_tipo_cambio").notNull().default(6),
    ...timestampsColumns,
  },
  (t) => [unique("empresas_firma_rut_unique").on(t.firmaContableId, t.rut)],
);
