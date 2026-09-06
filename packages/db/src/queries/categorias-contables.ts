import type { CrearCategoriaInput, EditarCategoriaInput } from "@erp/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { categoriasContables } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

/** 3.11 — Categorías contables (determinación de cuentas) de una empresa. */
export async function listarCategorias(empresaId: string) {
  return db
    .select()
    .from(categoriasContables)
    .where(eq(categoriasContables.empresaId, empresaId))
    .orderBy(asc(categoriasContables.nombre));
}

function valoresCategoria(input: CrearCategoriaInput | EditarCategoriaInput) {
  return {
    nombre: input.nombre,
    aplicaA: input.aplicaA,
    cuentaGastoId: input.cuentaGastoId ?? null,
    cuentaIngresoId: input.cuentaIngresoId ?? null,
    cuentaCostoId: input.cuentaCostoId ?? null,
    cuentaActivoId: input.cuentaActivoId ?? null,
    centroCostoDefaultId: input.centroCostoDefaultId ?? null,
    ivaRecuperableDefault: input.ivaRecuperableDefault ?? null,
  };
}

export async function crearCategoria(
  empresaId: string,
  input: CrearCategoriaInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [categoria] = await tx
      .insert(categoriasContables)
      .values({ empresaId, ...valoresCategoria(input) })
      .returning();
    if (!categoria) throw new Error("No se pudo crear la categoría contable");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "categorias_contables",
        registroId: categoria.id,
        etiqueta: categoria.nombre,
        accion: "crear",
        despues: categoria,
      });
    }
    return categoria;
  });
}

export async function actualizarCategoria(
  categoriaId: string,
  empresaId: string,
  input: EditarCategoriaInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(categoriasContables)
      .where(
        and(eq(categoriasContables.id, categoriaId), eq(categoriasContables.empresaId, empresaId)),
      );
    if (!antes) {
      throw new Error("No se pudo actualizar la categoría contable (no existe en esta empresa)");
    }

    const [categoria] = await tx
      .update(categoriasContables)
      .set({ ...valoresCategoria(input), updatedAt: new Date() })
      .where(
        and(eq(categoriasContables.id, categoriaId), eq(categoriasContables.empresaId, empresaId)),
      )
      .returning();
    if (!categoria) {
      throw new Error("No se pudo actualizar la categoría contable (no existe en esta empresa)");
    }

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "categorias_contables",
        registroId: categoria.id,
        etiqueta: categoria.nombre,
        accion: "editar",
        antes,
        despues: categoria,
      });
    }
    return categoria;
  });
}
