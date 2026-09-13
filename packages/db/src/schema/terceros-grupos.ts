import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { categoriasContables } from "./categorias-contables";
import { empresas } from "./empresas";
import { planCuentas } from "./plan-cuentas";

/**
 * Grupos de socios de negocio (segmentación / reportería) — catálogo por empresa.
 * `cuentaContableAsociadaId`/`categoriaContableDefaultId` son el nivel intermedio de
 * determinación de cuentas: se usan cuando el tercero no tiene su propia cuenta/categoría
 * asignada, antes de caer al fallback GENERAL. Como un grupo puede mezclar Clientes y
 * Proveedores, no se restringe aquí por `tipoCuenta` — la cuenta puente igual se valida
 * contra el tipo de tercero al contabilizar.
 */
export const tercerosGrupos = pgTable(
  "terceros_grupos",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    cuentaContableAsociadaId: uuid("cuenta_contable_asociada_id").references(() => planCuentas.id, {
      onDelete: "restrict",
    }),
    categoriaContableDefaultId: uuid("categoria_contable_default_id").references(
      () => categoriasContables.id,
      { onDelete: "set null" },
    ),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("terceros_grupos_empresa_codigo_unique").on(t.empresaId, t.codigo)],
);
