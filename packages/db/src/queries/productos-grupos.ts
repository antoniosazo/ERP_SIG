import type { CrearProductoGrupoInput, EditarProductoGrupoInput } from "@erp/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { productosGrupos } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

/** Grupos de productos de una empresa, ordenados por nombre. */
export async function listarProductosGrupos(empresaId: string) {
  return db
    .select()
    .from(productosGrupos)
    .where(eq(productosGrupos.empresaId, empresaId))
    .orderBy(asc(productosGrupos.nombre));
}

function valores(input: CrearProductoGrupoInput | EditarProductoGrupoInput) {
  return {
    nombre: input.nombre,
    cuentaIngresoDefaultId: input.cuentaIngresoDefaultId ?? null,
    impuestoDefaultId: input.impuestoDefaultId ?? null,
    centroCostoDefaultId: input.centroCostoDefaultId ?? null,
    categoriaContableDefaultId: input.categoriaContableDefaultId ?? null,
    cuentaInventarioDefaultId: input.cuentaInventarioDefaultId ?? null,
    cuentaCostoVentaDefaultId: input.cuentaCostoVentaDefaultId ?? null,
    cuentaGastoCompraDefaultId: input.cuentaGastoCompraDefaultId ?? null,
    impuestoCompraDefaultId: input.impuestoCompraDefaultId ?? null,
    cuentaDotacionDefaultId: input.cuentaDotacionDefaultId ?? null,
    cuentaDesviacionDefaultId: input.cuentaDesviacionDefaultId ?? null,
    cuentaDiferenciaPrecioDefaultId: input.cuentaDiferenciaPrecioDefaultId ?? null,
    cuentaAjusteStockNegativoDefaultId: input.cuentaAjusteStockNegativoDefaultId ?? null,
    cuentaCompensacionStockReduccionDefaultId: input.cuentaCompensacionStockReduccionDefaultId ?? null,
    cuentaCompensacionStockAumentoDefaultId: input.cuentaCompensacionStockAumentoDefaultId ?? null,
    cuentaDevolucionVentaDefaultId: input.cuentaDevolucionVentaDefaultId ?? null,
    cuentaIngresoExtranjeroDefaultId: input.cuentaIngresoExtranjeroDefaultId ?? null,
    cuentaCostoExtranjeroDefaultId: input.cuentaCostoExtranjeroDefaultId ?? null,
    cuentaDiferenciaCambioDefaultId: input.cuentaDiferenciaCambioDefaultId ?? null,
    cuentaCompensacionMercaderiaDefaultId: input.cuentaCompensacionMercaderiaDefaultId ?? null,
    cuentaReduccionLibroMayorDefaultId: input.cuentaReduccionLibroMayorDefaultId ?? null,
    cuentaAumentoLibroMayorDefaultId: input.cuentaAumentoLibroMayorDefaultId ?? null,
    cuentaStockWipDefaultId: input.cuentaStockWipDefaultId ?? null,
    cuentaDesviacionStockWipDefaultId: input.cuentaDesviacionStockWipDefaultId ?? null,
    cuentaPygCompensacionWipDefaultId: input.cuentaPygCompensacionWipDefaultId ?? null,
    cuentaPygCompensacionStockDefaultId: input.cuentaPygCompensacionStockDefaultId ?? null,
  };
}

export async function crearProductoGrupo(
  empresaId: string,
  input: CrearProductoGrupoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [grupo] = await tx
      .insert(productosGrupos)
      .values({ empresaId, ...valores(input) })
      .returning();
    if (!grupo) throw new Error("No se pudo crear el grupo de productos");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "productos_grupos",
        registroId: grupo.id,
        etiqueta: grupo.nombre,
        accion: "crear",
        despues: grupo,
      });
    }
    return grupo;
  });
}

export async function actualizarProductoGrupo(
  grupoId: string,
  empresaId: string,
  input: EditarProductoGrupoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(productosGrupos)
      .where(and(eq(productosGrupos.id, grupoId), eq(productosGrupos.empresaId, empresaId)));
    if (!antes) throw new Error("El grupo de productos no existe en esta empresa");

    const [grupo] = await tx
      .update(productosGrupos)
      .set({ ...valores(input), updatedAt: new Date() })
      .where(and(eq(productosGrupos.id, grupoId), eq(productosGrupos.empresaId, empresaId)))
      .returning();
    if (!grupo) throw new Error("No se pudo actualizar el grupo de productos");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "productos_grupos",
        registroId: grupo.id,
        etiqueta: grupo.nombre,
        accion: "editar",
        antes,
        despues: grupo,
      });
    }
    return grupo;
  });
}
