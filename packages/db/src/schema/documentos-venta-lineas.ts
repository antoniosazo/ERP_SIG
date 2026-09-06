import { boolean, date, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { categoriasContables } from "./categorias-contables";
import { centrosCosto } from "./centros-costo";
import { documentosVenta } from "./documentos-venta";
import { impuestos } from "./impuestos";
import { planCuentas } from "./plan-cuentas";
import { productos } from "./productos";

/**
 * Línea de un documento de venta: cantidad × precio unitario (con descuento de línea y
 * el descuento global de la cabecera) determina `montoNeto`, que el backend calcula y
 * persiste. Reparte además cuenta de ingreso / centro de costo / categoría. `montoImpuesto`
 * sale de `montoNeto` y la tasa del impuesto (si no `esExento`).
 */
export const documentosVentaLineas = pgTable("documentos_venta_lineas", {
  id: idColumn(),
  documentoVentaId: uuid("documento_venta_id")
    .notNull()
    .references(() => documentosVenta.id, { onDelete: "cascade" }),
  numeroLinea: integer("numero_linea").notNull(),
  glosa: text("glosa"),
  productoId: uuid("producto_id").references(() => productos.id, { onDelete: "set null" }),
  cuentaIngresoId: uuid("cuenta_ingreso_id")
    .notNull()
    .references(() => planCuentas.id, { onDelete: "restrict" }),
  categoriaContableId: uuid("categoria_contable_id").references(() => categoriasContables.id, {
    onDelete: "set null",
  }),
  centroCostoId: uuid("centro_costo_id").references(() => centrosCosto.id, {
    onDelete: "restrict",
  }),
  impuestoId: uuid("impuesto_id").references(() => impuestos.id, { onDelete: "set null" }),
  cantidad: numeric("cantidad", { precision: 19, scale: 6 }).notNull().default("1"),
  precioUnitario: montoColumn("precio_unitario").notNull().default("0"),
  descuentoLineaPct: numeric("descuento_linea_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  montoNeto: montoColumn("monto_neto").notNull(),
  esExento: boolean("es_exento").notNull().default(false),
  montoImpuesto: montoColumn("monto_impuesto").notNull().default("0"),
  fechaDiferimiento: date("fecha_diferimiento"),
  ...timestampsColumns,
});
