import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { ivaRecuperableEnum } from "./enums";
import { categoriasContables } from "./categorias-contables";
import { centrosCosto } from "./centros-costo";
import { documentosCompra } from "./documentos-compra";
import { impuestos } from "./impuestos";
import { planCuentas } from "./plan-cuentas";
import { productos } from "./productos";

/**
 * Línea de un documento de compra. `cuentaImputacionId` es la cuenta de cargo (gasto o
 * existencias). `cantidadPendiente` (open_qty) solo se usa en `pedido`: se decrementa al
 * "traer" la línea a un documento posterior. `documentoBaseLineaId` da la trazabilidad
 * (línea de la que proviene esta).
 */
export const documentosCompraLineas = pgTable("documentos_compra_lineas", {
  id: idColumn(),
  documentoCompraId: uuid("documento_compra_id")
    .notNull()
    .references(() => documentosCompra.id, { onDelete: "cascade" }),
  numeroLinea: integer("numero_linea").notNull(),
  glosa: text("glosa"),
  productoId: uuid("producto_id").references(() => productos.id, { onDelete: "set null" }),
  cuentaImputacionId: uuid("cuenta_imputacion_id")
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
  ivaRecuperable: ivaRecuperableEnum("iva_recuperable"),
  cantidadPendiente: numeric("cantidad_pendiente", { precision: 19, scale: 6 })
    .notNull()
    .default("0"),
  documentoBaseLineaId: uuid("documento_base_linea_id").references(
    (): AnyPgColumn => documentosCompraLineas.id,
    { onDelete: "set null" },
  ),
  ...timestampsColumns,
});
