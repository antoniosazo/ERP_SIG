import type { GuardarFormatoCartolaInput } from "@erp/shared";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "../client";
import { cartolasFormatoCampos, cartolasFormatos } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

/** Plantillas de mapeo de cartola: globales (empresaId null) + propias de la empresa. */
export async function listarFormatosCartola(empresaId: string) {
  const formatos = await db
    .select()
    .from(cartolasFormatos)
    .where(or(isNull(cartolasFormatos.empresaId), eq(cartolasFormatos.empresaId, empresaId)))
    .orderBy(asc(cartolasFormatos.nombre));
  const campos = await db.select().from(cartolasFormatoCampos);
  const camposPorFormato = new Map<string, typeof campos>();
  for (const c of campos) {
    const lista = camposPorFormato.get(c.formatoId) ?? [];
    lista.push(c);
    camposPorFormato.set(c.formatoId, lista);
  }
  return formatos.map((f) => ({ ...f, campos: camposPorFormato.get(f.id) ?? [] }));
}

export async function obtenerFormatoCartola(formatoId: string, empresaId: string) {
  const [formato] = await db
    .select()
    .from(cartolasFormatos)
    .where(
      and(eq(cartolasFormatos.id, formatoId), or(isNull(cartolasFormatos.empresaId), eq(cartolasFormatos.empresaId, empresaId))),
    );
  if (!formato) return null;
  const campos = await db.select().from(cartolasFormatoCampos).where(eq(cartolasFormatoCampos.formatoId, formatoId));
  return { ...formato, campos };
}

/** Crea o edita una plantilla propia de la empresa (nunca toca una plantilla global). */
export async function guardarFormatoCartola(empresaId: string, input: GuardarFormatoCartolaInput, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    let antes: typeof cartolasFormatos.$inferSelect | undefined;
    if (input.id) {
      [antes] = await tx
        .select()
        .from(cartolasFormatos)
        .where(and(eq(cartolasFormatos.id, input.id), eq(cartolasFormatos.empresaId, empresaId)));
      if (!antes) throw new Error("La plantilla no existe en esta empresa");
    }

    const valores = {
      empresaId,
      bancoId: input.bancoId,
      nombre: input.nombre,
      tipoArchivo: input.tipoArchivo,
      codificacion: input.codificacion,
      separador: input.separador || null,
      filasOmitirInicio: input.filasOmitirInicio,
      filasOmitirFin: input.filasOmitirFin,
      formatoFecha: input.formatoFecha,
      formatoNumero: input.formatoNumero,
      reglaSigno: input.reglaSigno,
      activo: input.activo,
    };

    const [formato] = antes
      ? await tx
          .update(cartolasFormatos)
          .set({ ...valores, updatedAt: new Date() })
          .where(eq(cartolasFormatos.id, antes.id))
          .returning()
      : await tx.insert(cartolasFormatos).values(valores).returning();
    if (!formato) throw new Error("No se pudo guardar la plantilla de cartola");

    await tx.delete(cartolasFormatoCampos).where(eq(cartolasFormatoCampos.formatoId, formato.id));
    await tx.insert(cartolasFormatoCampos).values(
      input.campos.map((c) => ({
        formatoId: formato.id,
        campoDestino: c.campoDestino,
        columnaIndice: c.columnaIndice ?? null,
        posicionInicio: c.posicionInicio ?? null,
        posicionLargo: c.posicionLargo ?? null,
      })),
    );

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "cartolas_formatos",
        registroId: formato.id,
        etiqueta: formato.nombre,
        accion: antes ? "editar" : "crear",
        antes,
        despues: formato,
      });
    }
    return formato;
  });
}
