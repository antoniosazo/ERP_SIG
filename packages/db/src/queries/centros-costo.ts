import type { CrearCentroCostoInput, EditarCentroCostoInput } from "@erp/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { centrosCosto } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

const etiquetaCentro = (c: { codigo: string; nombre: string }) => `${c.codigo} — ${c.nombre}`;

/** 3.3 — Centros de costo de una empresa, ordenados por código. */
export async function listarCentrosCosto(empresaId: string) {
  return db
    .select()
    .from(centrosCosto)
    .where(eq(centrosCosto.empresaId, empresaId))
    .orderBy(asc(centrosCosto.codigo));
}

/** Valida que `centroPadreId`, si viene, sea un centro de costo de la misma empresa. */
async function validarPadre(empresaId: string, centroPadreId: string | null | undefined) {
  if (!centroPadreId) return;
  const [padre] = await db
    .select({ id: centrosCosto.id })
    .from(centrosCosto)
    .where(and(eq(centrosCosto.id, centroPadreId), eq(centrosCosto.empresaId, empresaId)));
  if (!padre) throw new Error("El centro de costo padre no existe en esta empresa");
}

export async function crearCentroCosto(
  empresaId: string,
  input: CrearCentroCostoInput,
  ctx?: AuditoriaCtx,
) {
  await validarPadre(empresaId, input.centroPadreId);
  return db.transaction(async (tx) => {
    const [centro] = await tx
      .insert(centrosCosto)
      .values({
        empresaId,
        centroPadreId: input.centroPadreId ?? null,
        codigo: input.codigo,
        nombre: input.nombre,
        estado: input.estado,
      })
      .returning();
    if (!centro) throw new Error("No se pudo crear el centro de costo");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "centros_costo",
        registroId: centro.id,
        etiqueta: etiquetaCentro(centro),
        accion: "crear",
        despues: centro,
      });
    }
    return centro;
  });
}

export async function actualizarCentroCosto(
  centroCostoId: string,
  empresaId: string,
  input: EditarCentroCostoInput,
  ctx?: AuditoriaCtx,
) {
  if (input.centroPadreId === centroCostoId) {
    throw new Error("Un centro de costo no puede ser su propio centro padre");
  }
  await validarPadre(empresaId, input.centroPadreId);
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(centrosCosto)
      .where(and(eq(centrosCosto.id, centroCostoId), eq(centrosCosto.empresaId, empresaId)));
    if (!antes) {
      throw new Error("No se pudo actualizar el centro de costo (no existe en esta empresa)");
    }

    const [centro] = await tx
      .update(centrosCosto)
      .set({
        centroPadreId: input.centroPadreId ?? null,
        codigo: input.codigo,
        nombre: input.nombre,
        estado: input.estado,
        updatedAt: new Date(),
      })
      .where(and(eq(centrosCosto.id, centroCostoId), eq(centrosCosto.empresaId, empresaId)))
      .returning();
    if (!centro) {
      throw new Error("No se pudo actualizar el centro de costo (no existe en esta empresa)");
    }

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "centros_costo",
        registroId: centro.id,
        etiqueta: etiquetaCentro(centro),
        accion: "editar",
        antes,
        despues: centro,
      });
    }
    return centro;
  });
}
