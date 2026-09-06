import type { CrearGrupoTerceroInput, EditarGrupoTerceroInput } from "@erp/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { tercerosGrupos } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

const etiqueta = (g: { codigo: string; nombre: string }) => `${g.codigo} — ${g.nombre}`;

export async function listarGruposTercero(empresaId: string) {
  return db
    .select()
    .from(tercerosGrupos)
    .where(eq(tercerosGrupos.empresaId, empresaId))
    .orderBy(asc(tercerosGrupos.codigo));
}

export async function crearGrupoTercero(
  empresaId: string,
  input: CrearGrupoTerceroInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [grupo] = await tx
      .insert(tercerosGrupos)
      .values({ empresaId, codigo: input.codigo, nombre: input.nombre })
      .returning();
    if (!grupo) throw new Error("No se pudo crear el grupo");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "terceros_grupos",
        registroId: grupo.id,
        etiqueta: etiqueta(grupo),
        accion: "crear",
        despues: grupo,
      });
    }
    return grupo;
  });
}

export async function actualizarGrupoTercero(
  grupoId: string,
  empresaId: string,
  input: EditarGrupoTerceroInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(tercerosGrupos)
      .where(and(eq(tercerosGrupos.id, grupoId), eq(tercerosGrupos.empresaId, empresaId)));
    if (!antes) throw new Error("El grupo no existe en esta empresa");
    const [grupo] = await tx
      .update(tercerosGrupos)
      .set({ codigo: input.codigo, nombre: input.nombre, updatedAt: new Date() })
      .where(and(eq(tercerosGrupos.id, grupoId), eq(tercerosGrupos.empresaId, empresaId)))
      .returning();
    if (!grupo) throw new Error("El grupo no existe en esta empresa");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "terceros_grupos",
        registroId: grupo.id,
        etiqueta: etiqueta(grupo),
        accion: "editar",
        antes,
        despues: grupo,
      });
    }
    return grupo;
  });
}

export async function eliminarGrupoTercero(grupoId: string, empresaId: string, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const [grupo] = await tx
      .delete(tercerosGrupos)
      .where(and(eq(tercerosGrupos.id, grupoId), eq(tercerosGrupos.empresaId, empresaId)))
      .returning();
    if (!grupo) throw new Error("El grupo no existe en esta empresa");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "terceros_grupos",
        registroId: grupo.id,
        etiqueta: etiqueta(grupo),
        accion: "eliminar",
        antes: grupo,
      });
    }
    return grupo;
  });
}
