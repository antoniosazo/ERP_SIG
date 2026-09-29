import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { asientosContables } from "../schema";

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
