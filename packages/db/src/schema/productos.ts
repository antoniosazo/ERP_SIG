import { boolean, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { metodoValoracionEnum, productoTipoEnum } from "./enums";
import { categoriasContables } from "./categorias-contables";
import { centrosCosto } from "./centros-costo";
import { empresas } from "./empresas";
import { impuestos } from "./impuestos";
import { planCuentas } from "./plan-cuentas";
import { productosGrupos } from "./productos-grupos";

/**
 * Catálogo de productos/servicios por empresa. Este ERP no lleva inventario: el producto
 * es una plantilla de imputación contable para las líneas de documento (cuenta de ingreso,
 * impuesto, precio, centro de costo, categoría). Los campos nulos heredan del grupo.
 */
export const productos = pgTable(
  "productos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    grupoId: uuid("grupo_id")
      .notNull()
      .references(() => productosGrupos.id, { onDelete: "restrict" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    tipo: productoTipoEnum("tipo").notNull().default("Producto"),
    estado: text("estado").notNull().default("Activo"),
    precioUnitario: montoColumn("precio_unitario").notNull().default("0"),
    unidadMedida: text("unidad_medida"),
    codigoBarras: text("codigo_barras"),
    glosaSugerida: text("glosa_sugerida"),
    esVenta: boolean("es_venta").notNull().default(true),
    esCompra: boolean("es_compra").notNull().default(false),
    esInventario: boolean("es_inventario").notNull().default(false),
    metodoValoracion: metodoValoracionEnum("metodo_valoracion").notNull().default("Promedio"),
    costoEstandar: montoColumn("costo_estandar").notNull().default("0"),
    cuentaIngresoId: uuid("cuenta_ingreso_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    impuestoId: uuid("impuesto_id").references(() => impuestos.id, { onDelete: "set null" }),
    centroCostoId: uuid("centro_costo_id").references(() => centrosCosto.id, {
      onDelete: "set null",
    }),
    categoriaContableId: uuid("categoria_contable_id").references(() => categoriasContables.id, {
      onDelete: "set null",
    }),
    cuentaInventarioId: uuid("cuenta_inventario_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    cuentaCostoVentaId: uuid("cuenta_costo_venta_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    cuentaGastoCompraId: uuid("cuenta_gasto_compra_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    impuestoCompraId: uuid("impuesto_compra_id").references(() => impuestos.id, {
      onDelete: "set null",
    }),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("productos_empresa_codigo_unique").on(t.empresaId, t.codigo),
    index("productos_empresa_estado_idx").on(t.empresaId, t.estado),
    index("productos_empresa_barcode_idx")
      .on(t.empresaId, t.codigoBarras)
      .where(sql`${t.codigoBarras} is not null`),
  ],
);
