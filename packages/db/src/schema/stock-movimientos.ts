import { date, index, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { stockMovimientoTipoEnum } from "./enums";
import { asientosContables } from "./asientos-contables";
import { empresas } from "./empresas";
import { productos } from "./productos";

/**
 * Kardex de inventario: cada fila es un movimiento (entrada / salida / ajuste). `saldo*`
 * son el estado del producto justo después del movimiento. `origenTabla`/`origenId`
 * apuntan al documento que lo generó (p. ej. `documentos_compra`).
 */
export const stockMovimientos = pgTable(
  "stock_movimientos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "restrict" }),
    fecha: date("fecha").notNull(),
    tipo: stockMovimientoTipoEnum("tipo").notNull(),
    cantidad: numeric("cantidad", { precision: 19, scale: 6 }).notNull(),
    costoUnitario: montoColumn("costo_unitario").notNull(),
    costoTotal: montoColumn("costo_total").notNull(),
    saldoCantidad: numeric("saldo_cantidad", { precision: 19, scale: 6 }).notNull(),
    saldoCostoPromedio: montoColumn("saldo_costo_promedio").notNull(),
    origenTabla: text("origen_tabla"),
    origenId: uuid("origen_id"),
    asientoId: uuid("asiento_id").references(() => asientosContables.id, { onDelete: "set null" }),
    glosa: text("glosa"),
    ...timestampsColumns,
  },
  (t) => [index("stock_movimientos_empresa_producto_fecha_idx").on(t.empresaId, t.productoId, t.fecha)],
);
