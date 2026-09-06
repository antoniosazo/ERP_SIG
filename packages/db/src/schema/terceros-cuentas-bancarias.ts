import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { cuentaBancariaTipoEnum } from "./enums";
import { bancos } from "./bancos";
import { terceros } from "./terceros";

/** Cuentas bancarias de un socio de negocio (para pagos/cobros) — CRD7 de SAP B1. */
export const tercerosCuentasBancarias = pgTable("terceros_cuentas_bancarias", {
  id: idColumn(),
  terceroId: uuid("tercero_id")
    .notNull()
    .references(() => terceros.id, { onDelete: "cascade" }),
  bancoId: uuid("banco_id")
    .notNull()
    .references(() => bancos.id, { onDelete: "restrict" }),
  tipoCuenta: cuentaBancariaTipoEnum("tipo_cuenta").notNull(),
  numeroCuenta: text("numero_cuenta").notNull(),
  titular: text("titular"),
  rutTitular: text("rut_titular"),
  esPrincipal: boolean("es_principal").notNull().default(false),
  ...timestampsColumns,
});
