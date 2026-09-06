import { pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { determinacionContextoEnum, determinacionRolEnum } from "./enums";
import { empresas } from "./empresas";
import { planCuentas } from "./plan-cuentas";

/**
 * Motor de determinación de cuentas — nivel GENERAL. Una fila por (empresa, contexto,
 * rol): la cuenta por defecto de la empresa para ese rol contable. Los overrides por
 * categoría / producto / grupo / impuesto / tercero ganan; esta regla es el fallback.
 */
export const reglasDeterminacionCuenta = pgTable(
  "reglas_determinacion_cuenta",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    contexto: determinacionContextoEnum("contexto").notNull(),
    rol: determinacionRolEnum("rol").notNull(),
    cuentaId: uuid("cuenta_id")
      .notNull()
      .references(() => planCuentas.id, { onDelete: "restrict" }),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("reglas_determinacion_cuenta_empresa_contexto_rol_unique").on(
      t.empresaId,
      t.contexto,
      t.rol,
    ),
  ],
);
