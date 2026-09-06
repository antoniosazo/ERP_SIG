import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, check, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampsColumns } from "./columns.helpers";
import {
  claseCuentaEnum,
  clasificacionCorrienteEnum,
  cuentaModoMonedaEnum,
  naturalezaCuentaEnum,
  tipoCuentaEnum,
} from "./enums";
import { empresas } from "./empresas";
import { monedas } from "./monedas";
import { planCuentasPlantillas } from "./plan-cuentas-plantillas";

/**
 * 3.2 — Plan de cuentas. Una fila pertenece a una plantilla global (`plantillaId`,
 * `empresaId = null`) o al árbol de una empresa (`empresaId`, `plantillaId = null`),
 * nunca a ambos — ver decisión de diseño 2 del plan.
 *
 * `clase` solo debería asignarse en cuentas raíz (`cuentaPadreId IS NULL`); las cuentas
 * hijas heredan la clase de su raíz. Esa herencia se resuelve en la capa de aplicación
 * (ver src/queries/plan-cuentas.ts), tal como recomienda la nota de implementación del ERD.
 *
 * `activa`: campo agregado al implementar el mantenedor de Plan de Cuentas (Módulo 4.9-D).
 * No está en el ERD original — permite "desactivar" una cuenta sin borrarla (las FKs de
 * `asientos_lineas` la siguen necesitando para asientos históricos).
 */
export const planCuentas = pgTable(
  "plan_cuentas",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    plantillaId: uuid("plantilla_id").references(() => planCuentasPlantillas.id, {
      onDelete: "cascade",
    }),
    cuentaPadreId: uuid("cuenta_padre_id").references((): AnyPgColumn => planCuentas.id, {
      onDelete: "restrict",
    }),
    codigoCuenta: text("codigo_cuenta").notNull(),
    nombreCuenta: text("nombre_cuenta").notNull(),
    clase: claseCuentaEnum("clase").notNull(),
    naturaleza: naturalezaCuentaEnum("naturaleza").notNull(),
    tipoCuenta: tipoCuentaEnum("tipo_cuenta").notNull().default("Otra"),
    clasificacionCorriente: clasificacionCorrienteEnum("clasificacion_corriente")
      .notNull()
      .default("No Aplica"),
    nivelImputable: boolean("nivel_imputable").notNull().default(true),
    requiereCentroCosto: boolean("requiere_centro_costo").notNull().default(false),
    requiereAnalisisTerceros: boolean("requiere_analisis_terceros").notNull().default(false),
    modoMoneda: cuentaModoMonedaEnum("modo_moneda").notNull().default("Funcional"),
    monedaFijaId: uuid("moneda_fija_id").references(() => monedas.id, { onDelete: "set null" }),
    relevanteFlujoCaja: boolean("relevante_flujo_caja").notNull().default(false),
    esCuentaAjuste: boolean("es_cuenta_ajuste").notNull().default(false),
    activa: boolean("activa").notNull().default(true),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("plan_cuentas_empresa_codigo_unique")
      .on(t.empresaId, t.codigoCuenta)
      .where(sql`${t.empresaId} is not null`),
    uniqueIndex("plan_cuentas_plantilla_codigo_unique")
      .on(t.plantillaId, t.codigoCuenta)
      .where(sql`${t.plantillaId} is not null`),
    check(
      "plan_cuentas_empresa_xor_plantilla",
      sql`(${t.empresaId} is not null and ${t.plantillaId} is null) or (${t.empresaId} is null and ${t.plantillaId} is not null)`,
    ),
  ],
);
