import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { categoriasContables } from "./categorias-contables";
import { centrosCosto } from "./centros-costo";
import { empresas } from "./empresas";
import { impuestos } from "./impuestos";
import { planCuentas } from "./plan-cuentas";

/**
 * Grupo de productos por empresa: "determinación de cuentas" (equivalente al Item Group
 * de SAP). Un producto hereda estos valores por defecto y puede sobrescribirlos.
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
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("productos_grupos_empresa_nombre_unique").on(t.empresaId, t.nombre)],
);
