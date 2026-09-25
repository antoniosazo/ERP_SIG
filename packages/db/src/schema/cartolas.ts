import { date, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { cartolaEstadoEnum, cartolaOrigenEnum } from "./enums";
import { empresas } from "./empresas";
import { cuentasBancarias } from "./cuentas-bancarias";
import { usuarios } from "./usuarios";

/**
 * Cartola bancaria importada (o cargada a mano, `origen: "Manual"`). No genera asientos —
 * solo registra lo que dice el banco; Conciliación (fase futura) la calza contra la
 * contabilidad.
 */
export const cartolas = pgTable(
  "cartolas",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    cuentaBancariaId: uuid("cuenta_bancaria_id")
      .notNull()
      .references(() => cuentasBancarias.id, { onDelete: "restrict" }),
    fechaDesde: date("fecha_desde").notNull(),
    fechaHasta: date("fecha_hasta").notNull(),
    saldoInicial: montoColumn("saldo_inicial").notNull(),
    saldoFinal: montoColumn("saldo_final").notNull(),
    origen: cartolaOrigenEnum("origen").notNull().default("Archivo"),
    archivoNombre: text("archivo_nombre"),
    archivoHash: text("archivo_hash"),
    estado: cartolaEstadoEnum("estado").notNull().default("Importada"),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("cartolas_cuenta_archivo_hash_unique")
      .on(t.cuentaBancariaId, t.archivoHash)
      .where(sql`${t.archivoHash} is not null`),
  ],
);
