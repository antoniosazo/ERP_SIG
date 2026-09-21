import { boolean, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { cuentaBancariaTipoEnum } from "./enums";
import { bancos } from "./bancos";
import { empresas } from "./empresas";
import { monedas } from "./monedas";
import { planCuentas } from "./plan-cuentas";

/**
 * Cuentas bancarias de la propia empresa (los "bancos de la casa" de SAP B1). Cada una
 * apunta a su cuenta contable de tipo Banco: ahí se contabilizan transferencias y cheques.
 * Distinta de `terceros_cuentas_bancarias`, que son las cuentas de clientes y proveedores.
 */
export const cuentasBancarias = pgTable(
  "cuentas_bancarias",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    bancoId: uuid("banco_id")
      .notNull()
      .references(() => bancos.id, { onDelete: "restrict" }),
    tipoCuenta: cuentaBancariaTipoEnum("tipo_cuenta").notNull().default("Corriente"),
    numeroCuenta: text("numero_cuenta").notNull(),
    alias: text("alias"),
    monedaId: uuid("moneda_id")
      .notNull()
      .references(() => monedas.id, { onDelete: "restrict" }),
    cuentaContableId: uuid("cuenta_contable_id")
      .notNull()
      .references(() => planCuentas.id, { onDelete: "restrict" }),
    activa: boolean("activa").notNull().default(true),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("cuentas_bancarias_empresa_banco_numero_unique").on(t.empresaId, t.bancoId, t.numeroCuenta)],
);
