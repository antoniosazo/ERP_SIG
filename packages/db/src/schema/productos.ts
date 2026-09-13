import { boolean, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { metodoValoracionEnum, productoTipoEnum } from "./enums";
import { empresas } from "./empresas";
import { productosGrupos } from "./productos-grupos";

/**
 * Catálogo de productos/servicios por empresa. Este ERP no lleva inventario propio del
 * producto: la imputación contable (cuenta de ingreso, impuesto, centro de costo,
 * categoría, existencias, costo de venta, gasto de compra) sale siempre de `grupoId` —
 * el producto no tiene cuenta propia, para no terminar con imputaciones dispersas
 * producto por producto en vez de administradas por grupo.
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
