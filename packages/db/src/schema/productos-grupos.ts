import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { categoriasContables } from "./categorias-contables";
import { centrosCosto } from "./centros-costo";
import { empresas } from "./empresas";
import { impuestos } from "./impuestos";
import { planCuentas } from "./plan-cuentas";

/**
 * Grupo de productos por empresa: "determinación de cuentas" por defecto. Un producto
 * hereda estos valores y puede sobrescribirlos.
 *
 * Las primeras 8 cuentas (ingreso/inventario/costo de venta/gasto de compra + impuestos y
 * centro de costo/categoría) son las que efectivamente consume la contabilización de
 * documentos hoy (ver `documentos-compra.ts`/`documentos-venta.ts`). El resto es un
 * catálogo más amplio de cuentas de ajuste de inventario, moneda extranjera y trabajo en
 * curso — hoy no hay módulo de conteo de inventario, costeo WIP ni diferencias de tipo de
 * cambio automatizadas en este sistema, así que esas cuentas quedan capturadas pero sin
 * lógica de posteo todavía.
 */
export const productosGrupos = pgTable(
  "productos_grupos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    cuentaIngresoDefaultId: uuid("cuenta_ingreso_default_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    impuestoDefaultId: uuid("impuesto_default_id").references(() => impuestos.id, {
      onDelete: "set null",
    }),
    centroCostoDefaultId: uuid("centro_costo_default_id").references(() => centrosCosto.id, {
      onDelete: "set null",
    }),
    categoriaContableDefaultId: uuid("categoria_contable_default_id").references(
      () => categoriasContables.id,
      { onDelete: "set null" },
    ),
    cuentaInventarioDefaultId: uuid("cuenta_inventario_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaCostoVentaDefaultId: uuid("cuenta_costo_venta_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaGastoCompraDefaultId: uuid("cuenta_gasto_compra_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    impuestoCompraDefaultId: uuid("impuesto_compra_default_id").references(() => impuestos.id, {
      onDelete: "set null",
    }),

    // ── Resto del catálogo de cuentas de determinación — ver nota arriba ──
    cuentaDotacionDefaultId: uuid("cuenta_dotacion_default_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    cuentaDesviacionDefaultId: uuid("cuenta_desviacion_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaDiferenciaPrecioDefaultId: uuid("cuenta_diferencia_precio_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaAjusteStockNegativoDefaultId: uuid("cuenta_ajuste_stock_negativo_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaCompensacionStockReduccionDefaultId: uuid(
      "cuenta_compensacion_stock_reduccion_default_id",
    ).references(() => planCuentas.id, { onDelete: "restrict" }),
    cuentaCompensacionStockAumentoDefaultId: uuid(
      "cuenta_compensacion_stock_aumento_default_id",
    ).references(() => planCuentas.id, { onDelete: "restrict" }),
    cuentaDevolucionVentaDefaultId: uuid("cuenta_devolucion_venta_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaIngresoExtranjeroDefaultId: uuid("cuenta_ingreso_extranjero_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaCostoExtranjeroDefaultId: uuid("cuenta_costo_extranjero_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaDiferenciaCambioDefaultId: uuid("cuenta_diferencia_cambio_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaCompensacionMercaderiaDefaultId: uuid(
      "cuenta_compensacion_mercaderia_default_id",
    ).references(() => planCuentas.id, { onDelete: "restrict" }),
    cuentaReduccionLibroMayorDefaultId: uuid("cuenta_reduccion_libro_mayor_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaAumentoLibroMayorDefaultId: uuid("cuenta_aumento_libro_mayor_default_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    cuentaStockWipDefaultId: uuid("cuenta_stock_wip_default_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    cuentaDesviacionStockWipDefaultId: uuid(
      "cuenta_desviacion_stock_wip_default_id",
    ).references(() => planCuentas.id, { onDelete: "restrict" }),
    cuentaPygCompensacionWipDefaultId: uuid(
      "cuenta_pyg_compensacion_wip_default_id",
    ).references(() => planCuentas.id, { onDelete: "restrict" }),
    cuentaPygCompensacionStockDefaultId: uuid(
      "cuenta_pyg_compensacion_stock_default_id",
    ).references(() => planCuentas.id, { onDelete: "restrict" }),

    ...timestampsColumns,
  },
  (t) => [uniqueIndex("productos_grupos_empresa_nombre_unique").on(t.empresaId, t.nombre)],
);
