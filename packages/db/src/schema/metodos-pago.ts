import { boolean, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { metodoPagoSentidoEnum, metodoPagoTipoEnum } from "./enums";
import { cuentasBancarias } from "./cuentas-bancarias";
import { empresas } from "./empresas";
import { planCuentas } from "./plan-cuentas";

/**
 * Métodos de pago (payment methods de SAP B1): controlan cómo se cobra/paga y contra qué
 * cuenta contable. Cuenta efectiva = `cuentaContableId` si existe (Caja, cuenta transitoria);
 * si no, la cuenta contable de `cuentaBancariaId`.
 */
export const metodosPago = pgTable(
  "metodos_pago",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    tipo: metodoPagoTipoEnum("tipo").notNull(),
    sentido: metodoPagoSentidoEnum("sentido").notNull().default("Ambos"),
    cuentaBancariaId: uuid("cuenta_bancaria_id").references(() => cuentasBancarias.id, { onDelete: "restrict" }),
    cuentaContableId: uuid("cuenta_contable_id").references(() => planCuentas.id, { onDelete: "restrict" }),
    activo: boolean("activo").notNull().default(true),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("metodos_pago_empresa_nombre_unique").on(t.empresaId, t.nombre)],
);
