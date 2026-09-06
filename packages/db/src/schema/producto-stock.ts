import { numeric, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { empresas } from "./empresas";
import { productos } from "./productos";

/**
 * Saldo de inventario por producto (un almacén implícito por empresa). Se mantiene por
 * el motor de stock (`queries/stock.ts`); el Kardex vive en `stock_movimientos`.
 */
export const productoStock = pgTable(
  "producto_stock",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    cantidad: numeric("cantidad", { precision: 19, scale: 6 }).notNull().default("0"),
    costoPromedio: montoColumn("costo_promedio").notNull().default("0"),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("producto_stock_empresa_producto_unique").on(t.empresaId, t.productoId)],
);
