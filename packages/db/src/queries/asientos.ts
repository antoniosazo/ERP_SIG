import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { asientosContables, asientosLineas } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

/**
 * ¿La empresa tiene al menos un asiento contable registrado? Se usa para congelar
 * configuración que reinterpretaría montos ya guardados (decimales de moneda, moneda
 * funcional, decimales de tipo de cambio) una vez que hay transacciones.
 */
export async function empresaTieneAsientos(empresaId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: asientosContables.id })
    .from(asientosContables)
    .where(eq(asientosContables.empresaId, empresaId))
    .limit(1);
  return row !== undefined;
}

/**
 * Siguiente correlativo de asiento para una empresa y año. Serializa la asignación
 * hasta el commit para evitar números duplicados entre módulos concurrentes.
 */
export async function siguienteCorrelativoAsiento(
  tx: Tx,
  empresaId: string,
  anio: number,
): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`asientos:${empresaId}:${anio}`}))`);
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${asientosContables.correlativo}), 0)::int` })
    .from(asientosContables)
    .where(and(eq(asientosContables.empresaId, empresaId), eq(asientosContables.anio, anio)));
  return (row?.max ?? 0) + 1;
}

/**
 * Registra la creación de un asiento cuando ya se insertaron todas sus líneas.
 * Se ejecuta dentro de la misma transacción: asiento, líneas y auditoría confirman
 * juntos o se revierten juntos.
 */
export async function registrarAuditoriaCreacionAsiento(
  tx: Tx,
  empresaId: string,
  asientoId: string,
  ctx: AuditoriaCtx,
): Promise<void> {
  const [asiento] = await tx
    .select()
    .from(asientosContables)
    .where(and(eq(asientosContables.id, asientoId), eq(asientosContables.empresaId, empresaId)));
  if (!asiento) throw new Error("No se encontró el asiento para registrar su auditoría");

  const [totales] = await tx
    .select({
      lineas: sql<number>`count(*)::int`,
      debe: sql<string>`coalesce(sum(${asientosLineas.montoDebeFuncional}), 0)::text`,
      haber: sql<string>`coalesce(sum(${asientosLineas.montoHaberFuncional}), 0)::text`,
    })
    .from(asientosLineas)
    .where(eq(asientosLineas.asientoId, asientoId));

  await registrarAuditoria(tx, {
    empresaId,
    ctx,
    tabla: "asientos_contables",
    registroId: asiento.id,
    etiqueta: `Asiento N° ${asiento.correlativo ?? "Borrador"}`,
    accion: "crear",
    despues: {
      correlativo: asiento.correlativo,
      fecha: asiento.fecha,
      glosa: asiento.glosa,
      tipo: asiento.tipo,
      libro: asiento.libro,
      estado: asiento.estado,
      origen: asiento.origen,
      documentoOrigenTabla: asiento.documentoOrigenTabla,
      documentoOrigenId: asiento.documentoOrigenId,
      lineas: totales?.lineas ?? 0,
      totalDebe: totales?.debe ?? "0",
      totalHaber: totales?.haber ?? "0",
    },
  });
}
