import type { CrearTerceroInput, EditarTerceroInput } from "@erp/shared";
import { and, asc, eq } from "drizzle-orm";
import { formatearRut, normalizarRut } from "@erp/shared";
import { db } from "../client";
import {
  terceros,
  tercerosContactos,
  tercerosCuentasBancarias,
  tercerosDirecciones,
} from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { siguienteCodigo } from "./series";

const etiquetaTercero = (t: { rut: string; razonSocial: string }) =>
  `${formatearRut(t.rut)} ${t.razonSocial}`;

/** 3.6 — Maestro de socios de negocio de una empresa. */
export async function listarTerceros(empresaId: string) {
  return db
    .select()
    .from(terceros)
    .where(eq(terceros.empresaId, empresaId))
    .orderBy(asc(terceros.razonSocial));
}

export async function obtenerTerceroConDetalle(terceroId: string, empresaId: string) {
  const [tercero] = await db
    .select()
    .from(terceros)
    .where(and(eq(terceros.id, terceroId), eq(terceros.empresaId, empresaId)));
  if (!tercero) return null;

  const [contactos, direcciones, cuentasBancarias] = await Promise.all([
    db
      .select()
      .from(tercerosContactos)
      .where(eq(tercerosContactos.terceroId, terceroId))
      .orderBy(asc(tercerosContactos.nombre)),
    db
      .select()
      .from(tercerosDirecciones)
      .where(eq(tercerosDirecciones.terceroId, terceroId))
      .orderBy(asc(tercerosDirecciones.tipo)),
    db
      .select()
      .from(tercerosCuentasBancarias)
      .where(eq(tercerosCuentasBancarias.terceroId, terceroId)),
  ]);

  return { tercero, contactos, direcciones, cuentasBancarias };
}

function valoresEditables(input: EditarTerceroInput) {
  return {
    rut: normalizarRut(input.rut),
    razonSocial: input.razonSocial,
    tipoTercero: input.tipoTercero,
    nombreFantasia: input.nombreFantasia || null,
    giro: input.giro || null,
    email: input.email || null,
    telefono: input.telefono || null,
    sitioWeb: input.sitioWeb || null,
    direccion: input.direccion || null,
    notas: input.notas || null,
    grupoId: input.grupoId ?? null,
    monedaId: input.monedaId ?? null,
    impuestoDefaultId: input.impuestoDefaultId ?? null,
    cuentaContableAsociadaId: input.cuentaContableAsociadaId ?? null,
    categoriaContableDefaultId: input.categoriaContableDefaultId ?? null,
    condicionPagoDias: input.condicionPagoDias,
    limiteCredito: input.limiteCredito.toString(),
    retencionHonorariosPct:
      input.retencionHonorariosPct == null ? null : input.retencionHonorariosPct.toString(),
    esEmisorBoletaHonorarios: input.esEmisorBoletaHonorarios,
    esReceptorBoletaHonorarios: input.esReceptorBoletaHonorarios,
    pendienteCompletar: input.pendienteCompletar,
    activo: input.activo,
    bloqueado: input.bloqueado,
    motivoBloqueo: input.bloqueado ? (input.motivoBloqueo ?? null) : null,
  };
}

/** Alta rápida: rut + razón social + tipo. El `codigo` (CardCode) lo genera la serie. */
export async function crearTercero(
  empresaId: string,
  input: CrearTerceroInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const codigo = await siguienteCodigo(tx, empresaId, "tercero", input.tipoTercero);
    const [tercero] = await tx
      .insert(terceros)
      .values({
        empresaId,
        codigo,
        rut: normalizarRut(input.rut),
        razonSocial: input.razonSocial,
        tipoTercero: input.tipoTercero,
      })
      .returning();
    if (!tercero) throw new Error("No se pudo crear el tercero");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "terceros",
        registroId: tercero.id,
        etiqueta: etiquetaTercero(tercero),
        accion: "crear",
        despues: tercero,
      });
    }
    return tercero;
  });
}

export async function actualizarTercero(
  terceroId: string,
  empresaId: string,
  input: EditarTerceroInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(terceros)
      .where(and(eq(terceros.id, terceroId), eq(terceros.empresaId, empresaId)));
    if (!antes) throw new Error("No se pudo actualizar el tercero (no existe en esta empresa)");

    const [tercero] = await tx
      .update(terceros)
      .set({ ...valoresEditables(input), updatedAt: new Date() })
      .where(and(eq(terceros.id, terceroId), eq(terceros.empresaId, empresaId)))
      .returning();
    if (!tercero) throw new Error("No se pudo actualizar el tercero (no existe en esta empresa)");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "terceros",
        registroId: tercero.id,
        etiqueta: etiquetaTercero(tercero),
        accion: "editar",
        antes,
        despues: tercero,
      });
    }
    return tercero;
  });
}
