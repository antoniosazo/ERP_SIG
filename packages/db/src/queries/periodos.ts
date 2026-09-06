import type { CambiarEstadoPeriodoInput } from "@erp/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { periodosContables } from "../schema";
import { registrarAuditoria } from "./auditoria";

/** Dado un `YYYY-MM-DD`, calcula el rango [inicio, fin] del mes calendario que lo contiene. */
export function rangoDelMes(fechaISO: string): { anio: number; mes: number; fechaInicio: string; fechaFin: string } {
  const [anioStr, mesStr] = fechaISO.split("-");
  if (!anioStr || !mesStr) throw new Error(`Fecha inválida: ${fechaISO}`);
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const fechaInicio = `${anioStr}-${mesStr}-01`;
  // Date.UTC(anio, mes, 0) = día 0 del mes siguiente (0-indexado) = último día del mes actual.
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const fechaFin = `${anioStr}-${mesStr}-${String(ultimoDia).padStart(2, "0")}`;
  return { anio, mes, fechaInicio, fechaFin };
}

/** Periodo contable de una empresa que cubre la fecha dada (mismo mes), o `null`. */
export async function periodoDe(empresaId: string, fechaISO: string) {
  const { anio, mes } = rangoDelMes(fechaISO);
  const [periodo] = await db
    .select()
    .from(periodosContables)
    .where(
      and(
        eq(periodosContables.empresaId, empresaId),
        eq(periodosContables.anio, anio),
        eq(periodosContables.mes, mes),
      ),
    );
  return periodo ?? null;
}

/** Periodos contables de una empresa, ordenados cronológicamente. */
export async function listarPeriodos(empresaId: string) {
  return db
    .select()
    .from(periodosContables)
    .where(eq(periodosContables.empresaId, empresaId))
    .orderBy(asc(periodosContables.anio), asc(periodosContables.mes));
}

/**
 * Genera los 12 meses de un ejercicio (año calendario) para una empresa. Los meses que
 * ya existan se saltan (índice único empresa+año+mes). Devuelve cuántos creó.
 * Los periodos nacen `Bloqueado`: el contador los abre cuando va a trabajar ese mes.
 */
export async function generarEjercicio(empresaId: string, anio: number): Promise<number> {
  const filas = Array.from({ length: 12 }, (_, i) => {
    const { mes, fechaInicio, fechaFin } = rangoDelMes(`${anio}-${String(i + 1).padStart(2, "0")}-01`);
    return {
      empresaId,
      anio,
      mes,
      fechaInicio,
      fechaFin,
      estado: "Bloqueado" as const,
    };
  });

  const creadas = await db
    .insert(periodosContables)
    .values(filas)
    .onConflictDoNothing({
      target: [periodosContables.empresaId, periodosContables.anio, periodosContables.mes],
    })
    .returning({ id: periodosContables.id });

  return creadas.length;
}

function mesAnteriorDe(anio: number, mes: number): { anio: number; mes: number } {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}

/**
 * Cambia el "Status del período" (estilo SAP B1) aplicando las reglas del diseño (3.12):
 * cierres secuenciales (no se puede bloquear/cerrar un mes si el anterior sigue
 * `Desbloqueado`) y motivo obligatorio al reabrir. Registra `fechaCierre`,
 * `usuarioCierreId` y `motivoReapertura` en la misma fila (bitácora formal = pendiente).
 */
export async function cambiarEstadoPeriodo(
  periodoId: string,
  empresaId: string,
  {
    estado,
    motivo,
    usuarioId,
    usuarioNombre,
  }: CambiarEstadoPeriodoInput & { usuarioId?: string; usuarioNombre?: string },
) {
  const [periodo] = await db
    .select()
    .from(periodosContables)
    .where(and(eq(periodosContables.id, periodoId), eq(periodosContables.empresaId, empresaId)));
  if (!periodo) throw new Error("El periodo no existe en esta empresa");

  if (periodo.estado === estado) return periodo;

  const cierra = estado !== "Desbloqueado";
  // "Reabrir" (exige motivo) solo aplica a un periodo que se cerró de verdad; abrir por
  // primera vez uno recién generado (nace `Bloqueado`, sin `fechaCierre`) no lo es.
  const reabre = estado === "Desbloqueado" && periodo.fechaCierre !== null;

  if (reabre && !motivo?.trim()) {
    throw new Error("Debes indicar un motivo para reabrir un periodo");
  }

  if (cierra) {
    const anterior = mesAnteriorDe(periodo.anio, periodo.mes);
    const [previo] = await db
      .select({ estado: periodosContables.estado, anio: periodosContables.anio, mes: periodosContables.mes })
      .from(periodosContables)
      .where(
        and(
          eq(periodosContables.empresaId, empresaId),
          eq(periodosContables.anio, anterior.anio),
          eq(periodosContables.mes, anterior.mes),
        ),
      );
    if (previo && previo.estado === "Desbloqueado") {
      throw new Error(
        `No puedes cerrar ${periodo.anio}-${String(periodo.mes).padStart(2, "0")} mientras ` +
          `${previo.anio}-${String(previo.mes).padStart(2, "0")} siga desbloqueado (los cierres son secuenciales)`,
      );
    }
  }

  return db.transaction(async (tx) => {
    const [actualizado] = await tx
      .update(periodosContables)
      .set({
        estado,
        fechaCierre: cierra ? new Date() : null,
        usuarioCierreId: usuarioId ?? null,
        motivoReapertura: reabre ? motivo!.trim() : periodo.motivoReapertura,
        updatedAt: new Date(),
      })
      .where(and(eq(periodosContables.id, periodoId), eq(periodosContables.empresaId, empresaId)))
      .returning();
    if (!actualizado) throw new Error("No se pudo actualizar el periodo");

    if (usuarioId) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { usuarioId, usuarioNombre: usuarioNombre ?? "—", motivo: motivo?.trim() },
        tabla: "periodos_contables",
        registroId: actualizado.id,
        etiqueta: `${actualizado.anio}-${String(actualizado.mes).padStart(2, "0")}`,
        accion: "cambio_estado",
        antes: { estado: periodo.estado },
        despues: { estado: actualizado.estado },
      });
    }
    return actualizado;
  });
}
