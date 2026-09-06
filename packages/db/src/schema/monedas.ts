import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { monedaTipoEnum } from "./enums";
import { empresas } from "./empresas";

/**
 * 3.9 — Monedas y unidades de reajuste. Igual que `plan_cuentas`, una fila es una
 * **plantilla global** (`empresaId IS NULL`, las del seed) o pertenece a una empresa
 * (`empresaId` con valor). Al crear una empresa se clonan las plantillas a su lista
 * propia (ver `clonarMonedas`). `codigoIso` = código ISO 4217 (opcional; UF/UTM no lo
 * tienen).
 */
export const monedas = pgTable(
  "monedas",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id").references((): AnyPgColumn => empresas.id, {
      onDelete: "cascade",
    }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    tipo: monedaTipoEnum("tipo").notNull(),
    simbolo: text("simbolo").notNull(),
    decimales: integer("decimales").notNull().default(2),
    codigoIso: text("codigo_iso"),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("monedas_empresa_codigo_unique")
      .on(t.empresaId, t.codigo)
      .where(sql`${t.empresaId} is not null`),
    uniqueIndex("monedas_plantilla_codigo_unique")
      .on(t.codigo)
      .where(sql`${t.empresaId} is null`),
  ],
);
