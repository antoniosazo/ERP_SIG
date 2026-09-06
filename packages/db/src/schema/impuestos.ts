import { boolean, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { impuestoTipoEnum, ivaRecuperableEnum, tipoOperacionDocumentoEnum } from "./enums";
import { empresas } from "./empresas";
import { planCuentas } from "./plan-cuentas";

/**
 * Maestro de impuestos por empresa (enfoque Chile: IVA débito/crédito, impuesto
 * adicional, exento y no afecto). Igual que `monedas` / `plan_cuentas`: una fila es
 * plantilla global (`empresa_id IS NULL`) o de una empresa. `cuenta_contable_id` es la
 * cuenta de G/L (IVA por pagar / crédito fiscal / adicional por pagar); en las
 * plantillas queda NULL y el contador la asigna por empresa.
 */
export const impuestos = pgTable(
  "impuestos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    tipo: impuestoTipoEnum("tipo").notNull(),
    tasa: numeric("tasa", { precision: 6, scale: 3 }).notNull().default("0"),
    cuentaContableId: uuid("cuenta_contable_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    recuperableDefault: ivaRecuperableEnum("recuperable_default"),
    aplicaA: tipoOperacionDocumentoEnum("aplica_a").notNull(),
    activo: boolean("activo").notNull().default(true),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("impuestos_empresa_codigo_unique")
      .on(t.empresaId, t.codigo)
      .where(sql`${t.empresaId} is not null`),
    uniqueIndex("impuestos_plantilla_codigo_unique")
      .on(t.codigo)
      .where(sql`${t.empresaId} is null`),
  ],
);
