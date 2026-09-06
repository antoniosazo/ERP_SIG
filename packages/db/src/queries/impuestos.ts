import type { CrearImpuestoInput, EditarImpuestoInput } from "@erp/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { impuestos } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

const etiquetaImpuesto = (i: { codigo: string; nombre: string }) => `${i.codigo} — ${i.nombre}`;

/** Impuestos plantilla (globales, `empresa_id IS NULL`). */
export async function listarImpuestosPlantilla() {
  return db
    .select()
    .from(impuestos)
    .where(isNull(impuestos.empresaId))
    .orderBy(asc(impuestos.codigo));
}

/** Lista de impuestos propia de una empresa. */
export async function listarImpuestosDeEmpresa(empresaId: string) {
  return db
    .select()
    .from(impuestos)
    .where(eq(impuestos.empresaId, empresaId))
    .orderBy(asc(impuestos.codigo));
}

/**
 * Clona los impuestos plantilla hacia la lista propia de una empresa recién creada
 * (mismo patrón que `clonarMonedas`). `cuentaContableId` queda null — el contador la
 * asigna por empresa.
 */
export async function clonarImpuestos(tx: Tx, empresaId: string): Promise<void> {
  const plantillas = await tx.select().from(impuestos).where(isNull(impuestos.empresaId));
  for (const i of plantillas) {
    await tx.insert(impuestos).values({
      empresaId,
      codigo: i.codigo,
      nombre: i.nombre,
      tipo: i.tipo,
      tasa: i.tasa,
      cuentaContableId: null,
      recuperableDefault: i.recuperableDefault,
      aplicaA: i.aplicaA,
      activo: i.activo,
    });
  }
}

function valoresImpuesto(input: CrearImpuestoInput | EditarImpuestoInput) {
  return {
    codigo: input.codigo,
    nombre: input.nombre,
    tipo: input.tipo,
    tasa: input.tasa.toString(),
    cuentaContableId: input.cuentaContableId ?? null,
    recuperableDefault: input.recuperableDefault ?? null,
    aplicaA: input.aplicaA,
    activo: input.activo,
  };
}

export async function crearImpuesto(
  empresaId: string,
  input: CrearImpuestoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [impuesto] = await tx
      .insert(impuestos)
      .values({ empresaId, ...valoresImpuesto(input) })
      .returning();
    if (!impuesto) throw new Error("No se pudo crear el impuesto");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "impuestos",
        registroId: impuesto.id,
        etiqueta: etiquetaImpuesto(impuesto),
        accion: "crear",
        despues: impuesto,
      });
    }
    return impuesto;
  });
}

export async function actualizarImpuesto(
  impuestoId: string,
  empresaId: string,
  input: EditarImpuestoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(impuestos)
      .where(and(eq(impuestos.id, impuestoId), eq(impuestos.empresaId, empresaId)));
    if (!antes) throw new Error("No se pudo actualizar el impuesto (no existe en esta empresa)");

    const [impuesto] = await tx
      .update(impuestos)
      .set({ ...valoresImpuesto(input), updatedAt: new Date() })
      .where(and(eq(impuestos.id, impuestoId), eq(impuestos.empresaId, empresaId)))
      .returning();
    if (!impuesto) throw new Error("No se pudo actualizar el impuesto (no existe en esta empresa)");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "impuestos",
        registroId: impuesto.id,
        etiqueta: etiquetaImpuesto(impuesto),
        accion: "editar",
        antes,
        despues: impuesto,
      });
    }
    return impuesto;
  });
}

export async function eliminarImpuesto(impuestoId: string, empresaId: string, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const [impuesto] = await tx
      .delete(impuestos)
      .where(and(eq(impuestos.id, impuestoId), eq(impuestos.empresaId, empresaId)))
      .returning();
    if (!impuesto) throw new Error("No se pudo eliminar el impuesto (no existe en esta empresa)");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "impuestos",
        registroId: impuesto.id,
        etiqueta: etiquetaImpuesto(impuesto),
        accion: "eliminar",
        antes: impuesto,
      });
    }
    return impuesto;
  });
}
