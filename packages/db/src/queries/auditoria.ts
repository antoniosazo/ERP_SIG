import type { AuditoriaAccion } from "@erp/shared";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { bitacoraAuditoria } from "../schema";

/** Contexto de quién hace la acción, que las actions pasan a las queries de mutación. */
export type AuditoriaCtx = { usuarioId: string; usuarioNombre: string; motivo?: string };

type RegistrarArgs = {
  empresaId: string | null;
  ctx: AuditoriaCtx;
  tabla: string;
  registroId: string;
  etiqueta: string;
  accion: AuditoriaAccion;
  antes?: unknown;
  despues?: unknown;
};

/** Inserta una fila de bitácora. Se llama dentro de la misma transacción que la mutación. */
export async function registrarAuditoria(tx: Tx, a: RegistrarArgs): Promise<void> {
  await tx.insert(bitacoraAuditoria).values({
    empresaId: a.empresaId,
    usuarioId: a.ctx.usuarioId,
    usuarioNombre: a.ctx.usuarioNombre,
    tablaAfectada: a.tabla,
    registroId: a.registroId,
    etiqueta: a.etiqueta,
    accion: a.accion,
    valoresAnteriores: a.antes === undefined ? null : (a.antes as object),
    valoresNuevos: a.despues === undefined ? null : (a.despues as object),
    motivo: a.ctx.motivo ?? null,
  });
}

export type FiltrosAuditoria = {
  tabla?: string;
  accion?: AuditoriaAccion;
  usuarioId?: string;
  desde?: string;
  hasta?: string;
  limite?: number;
  offset?: number;
};

/** Bitácora de una empresa, más reciente primero, con total para paginar. */
export async function listarAuditoriaDeEmpresa(empresaId: string, f: FiltrosAuditoria = {}) {
  const limite = Math.min(f.limite ?? 50, 200);
  const offset = f.offset ?? 0;

  const condiciones = [eq(bitacoraAuditoria.empresaId, empresaId)];
  if (f.tabla) condiciones.push(eq(bitacoraAuditoria.tablaAfectada, f.tabla));
  if (f.accion) condiciones.push(eq(bitacoraAuditoria.accion, f.accion));
  if (f.usuarioId) condiciones.push(eq(bitacoraAuditoria.usuarioId, f.usuarioId));
  if (f.desde) condiciones.push(gte(bitacoraAuditoria.creadoEn, new Date(f.desde)));
  if (f.hasta) condiciones.push(lte(bitacoraAuditoria.creadoEn, new Date(f.hasta)));
  const where = and(...condiciones);

  const [filas, [conteo]] = await Promise.all([
    db
      .select()
      .from(bitacoraAuditoria)
      .where(where)
      .orderBy(desc(bitacoraAuditoria.creadoEn))
      .limit(limite)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(bitacoraAuditoria).where(where),
  ]);

  return { filas, total: conteo?.total ?? 0, limite, offset };
}

/** Bitácora de un registro puntual (una ficha), más reciente primero. */
export async function listarAuditoriaDeRegistro(
  empresaId: string,
  tabla: string,
  registroId: string,
  limite = 100,
) {
  return db
    .select()
    .from(bitacoraAuditoria)
    .where(
      and(
        eq(bitacoraAuditoria.empresaId, empresaId),
        eq(bitacoraAuditoria.tablaAfectada, tabla),
        eq(bitacoraAuditoria.registroId, registroId),
      ),
    )
    .orderBy(desc(bitacoraAuditoria.creadoEn))
    .limit(Math.min(limite, 200));
}

/** Usuarios distintos que aparecen en la bitácora de una empresa (para el filtro). */
export async function listarUsuariosDeAuditoria(empresaId: string) {
  return db
    .selectDistinct({
      usuarioId: bitacoraAuditoria.usuarioId,
      usuarioNombre: bitacoraAuditoria.usuarioNombre,
    })
    .from(bitacoraAuditoria)
    .where(eq(bitacoraAuditoria.empresaId, empresaId))
    .orderBy(bitacoraAuditoria.usuarioNombre);
}
