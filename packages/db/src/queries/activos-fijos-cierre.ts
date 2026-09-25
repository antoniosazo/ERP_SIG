import type { CerrarEjercicioActivoFijoInput, LibroContable } from "@erp/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import { activosFijos, activosFijosCierres, activosFijosSaldos, activosFijosValoresPeriodo, periodosContables } from "../schema";
import { cuadroEvolucion } from "./activos-fijos";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { listarPeriodos } from "./periodos";

export type EstadoCierreActivoFijo = {
  anio: number;
  libro: LibroContable;
  cierre: {
    id: string;
    estado: "contabilizado" | "anulado";
    fechaReapertura: string | null;
    motivoReapertura: string | null;
  } | null;
  bloqueos: string[];
};

/**
 * ¿Se puede cerrar `libro`/`anio` ahora mismo? Exige los 12 meses del año bloqueados
 * (mismo chequeo que `estadoCierreEjercicio`) y la depreciación de diciembre ejecutada
 * para ese libro (si algún activo la requiere) — no genera asiento, es una fotografía.
 */
export async function estadoCierreActivoFijo(
  empresaId: string,
  libro: LibroContable,
  anio: number,
): Promise<EstadoCierreActivoFijo> {
  const bloqueos: string[] = [];
  const periodos = await listarPeriodos(empresaId);
  const delAnio = periodos.filter((p) => p.anio === anio);
  if (delAnio.length < 12) {
    bloqueos.push(`Faltan períodos de ${anio}: genera el ejercicio completo antes de cerrarlo.`);
  } else {
    const abiertos = delAnio.filter((p) => p.estado !== "Bloqueado").map((p) => String(p.mes).padStart(2, "0"));
    if (abiertos.length) bloqueos.push(`Hay meses sin bloquear en ${anio}: ${abiertos.join(", ")}.`);
  }

  const diciembre = delAnio.find((p) => p.mes === 12);
  if (diciembre) {
    const [depDiciembre] = await db
      .select({ id: activosFijosValoresPeriodo.activoId })
      .from(activosFijosValoresPeriodo)
      .where(
        and(
          eq(activosFijosValoresPeriodo.libro, libro),
          eq(activosFijosValoresPeriodo.periodoId, diciembre.id),
        ),
      )
      .limit(1);
    // Si hay ejecuciones de meses anteriores del año pero ninguna llegó a diciembre,
    // falta depreciación por correr antes de cerrar.
    const [algunMesDelAnio] = await db
      .select({ id: activosFijosValoresPeriodo.activoId })
      .from(activosFijosValoresPeriodo)
      .innerJoin(periodosContables, eq(activosFijosValoresPeriodo.periodoId, periodosContables.id))
      .where(
        and(
          eq(periodosContables.empresaId, empresaId),
          eq(activosFijosValoresPeriodo.libro, libro),
          eq(periodosContables.anio, anio),
        ),
      )
      .limit(1);
    if (algunMesDelAnio && !depDiciembre) {
      bloqueos.push(`Ejecuta la depreciación de diciembre de ${anio} para el libro ${libro} antes de cerrar.`);
    }
  }

  const anioAnteriorTienePeriodos = periodos.some((p) => p.anio === anio - 1);
  const [cierreAnterior] = anioAnteriorTienePeriodos
    ? await db
        .select({ estado: activosFijosCierres.estado })
        .from(activosFijosCierres)
        .where(and(eq(activosFijosCierres.empresaId, empresaId), eq(activosFijosCierres.libro, libro), eq(activosFijosCierres.anio, anio - 1)))
    : [];
  if (anioAnteriorTienePeriodos && cierreAnterior?.estado !== "contabilizado") {
    bloqueos.push(`Cierra primero el ejercicio ${anio - 1} de ${libro} (los cierres son secuenciales).`);
  }

  const [cierreRow] = await db
    .select()
    .from(activosFijosCierres)
    .where(and(eq(activosFijosCierres.empresaId, empresaId), eq(activosFijosCierres.libro, libro), eq(activosFijosCierres.anio, anio)));
  if (cierreRow?.estado === "contabilizado") {
    bloqueos.push(`El ejercicio ${anio} de ${libro} ya está cerrado. Reábrelo si necesitas corregirlo.`);
  }

  return {
    anio,
    libro,
    cierre: cierreRow
      ? {
          id: cierreRow.id,
          estado: cierreRow.estado,
          fechaReapertura: cierreRow.fechaReapertura,
          motivoReapertura: cierreRow.motivoReapertura,
        }
      : null,
    bloqueos,
  };
}

/**
 * Cierra el ejercicio del módulo: candado + fotografía, sin asiento propio (el
 * movimiento de dinero del año ya se contabilizó vía CAP/MEJ/DEP/baja). Congela una fila
 * en `activos_fijos_saldos` por cada activo valorado en `libro`, con las mismas cifras
 * que ya calcula `cuadroEvolucion`.
 */
export async function cerrarEjercicioActivoFijo(
  empresaId: string,
  input: CerrarEjercicioActivoFijoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const estado = await estadoCierreActivoFijo(empresaId, input.libro, input.anio);
    if (estado.bloqueos.length) throw new Error(estado.bloqueos[0]);

    const filas = await cuadroEvolucion(empresaId, input.libro, input.anio);

    for (const f of filas) {
      await tx
        .insert(activosFijosSaldos)
        .values({
          activoId: f.activoId,
          libro: input.libro,
          anio: input.anio,
          costoInicial: f.costoInicial.toString(),
          altas: f.altas.toString(),
          bajas: f.bajas.toString(),
          costoFinal: f.costoFinal.toString(),
          depAcumuladaInicial: f.depAcumuladaInicial.toString(),
          depEjercicio: f.depEjercicio.toString(),
          depBajas: f.depBajas.toString(),
          depAcumuladaFinal: f.depAcumuladaFinal.toString(),
          valorLibro: f.valorLibro.toString(),
        })
        .onConflictDoUpdate({
          target: [activosFijosSaldos.activoId, activosFijosSaldos.libro, activosFijosSaldos.anio],
          set: {
            costoInicial: f.costoInicial.toString(),
            altas: f.altas.toString(),
            bajas: f.bajas.toString(),
            costoFinal: f.costoFinal.toString(),
            depAcumuladaInicial: f.depAcumuladaInicial.toString(),
            depEjercicio: f.depEjercicio.toString(),
            depBajas: f.depBajas.toString(),
            depAcumuladaFinal: f.depAcumuladaFinal.toString(),
            valorLibro: f.valorLibro.toString(),
            updatedAt: new Date(),
          },
        });
    }

    const [existente] = await tx
      .select()
      .from(activosFijosCierres)
      .where(and(eq(activosFijosCierres.empresaId, empresaId), eq(activosFijosCierres.libro, input.libro), eq(activosFijosCierres.anio, input.anio)));
    const valores = {
      estado: "contabilizado" as const,
      fechaReapertura: null,
      motivoReapertura: null,
      usuarioId: ctx?.usuarioId ?? null,
      updatedAt: new Date(),
    };
    const [cierre] = existente
      ? await tx.update(activosFijosCierres).set(valores).where(eq(activosFijosCierres.id, existente.id)).returning()
      : await tx
          .insert(activosFijosCierres)
          .values({ empresaId, libro: input.libro, anio: input.anio, ...valores })
          .returning();
    if (!cierre) throw new Error("No se pudo registrar el cierre");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos_cierres",
        registroId: cierre.id,
        etiqueta: `Cierre de Activo Fijo ${input.libro} ${input.anio}`,
        accion: existente ? "editar" : "crear",
        despues: { libro: input.libro, anio: input.anio, activos: filas.length },
      });
    }
    return { cierre, activos: filas.length };
  });
}

/**
 * Reabre el ejercicio del módulo: marca el cierre anulado y borra los saldos congelados
 * de ese año (vuelven a calcularse en vivo, como antes de cerrar). Sin asiento de
 * reversa porque el cierre nunca generó uno.
 */
export async function reabrirEjercicioActivoFijo(
  empresaId: string,
  libro: LibroContable,
  anio: number,
  motivo: string,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [cierre] = await tx
      .select()
      .from(activosFijosCierres)
      .where(and(eq(activosFijosCierres.empresaId, empresaId), eq(activosFijosCierres.libro, libro), eq(activosFijosCierres.anio, anio)))
      .for("update");
    if (!cierre || cierre.estado !== "contabilizado") throw new Error(`El ejercicio ${anio} de ${libro} no está cerrado`);

    const [siguiente] = await tx
      .select({ estado: activosFijosCierres.estado })
      .from(activosFijosCierres)
      .where(and(eq(activosFijosCierres.empresaId, empresaId), eq(activosFijosCierres.libro, libro), eq(activosFijosCierres.anio, anio + 1)));
    if (siguiente?.estado === "contabilizado") {
      throw new Error(`Reabre primero el ejercicio ${anio + 1} de ${libro} (los cierres son secuenciales).`);
    }

    const [act] = await tx
      .update(activosFijosCierres)
      .set({
        estado: "anulado",
        fechaReapertura: new Date().toISOString().slice(0, 10),
        motivoReapertura: motivo,
        updatedAt: new Date(),
      })
      .where(eq(activosFijosCierres.id, cierre.id))
      .returning();
    if (!act) throw new Error("No se pudo reabrir el ejercicio");

    // Borra los saldos congelados de los activos de ESTA empresa en ese libro/año (la
    // tabla no tiene empresa_id: se acota por sus activos) — vuelven a calcularse en vivo
    // (misma lógica que usa el informe mientras el año está abierto).
    await tx
      .delete(activosFijosSaldos)
      .where(
        and(
          eq(activosFijosSaldos.libro, libro),
          eq(activosFijosSaldos.anio, anio),
          inArray(
            activosFijosSaldos.activoId,
            tx.select({ id: activosFijos.id }).from(activosFijos).where(eq(activosFijos.empresaId, empresaId)),
          ),
        ),
      );

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { ...ctx, motivo },
        tabla: "activos_fijos_cierres",
        registroId: cierre.id,
        etiqueta: `Cierre de Activo Fijo ${libro} ${anio}`,
        accion: "cambio_estado",
        antes: { estado: "contabilizado" },
        despues: { estado: "anulado" },
      });
    }
    return act;
  });
}

/** Últimos cierres del módulo para una empresa (para el listado de la pantalla de cierre). */
export async function listarCierresActivoFijo(empresaId: string) {
  return db
    .select()
    .from(activosFijosCierres)
    .where(eq(activosFijosCierres.empresaId, empresaId))
    .orderBy(desc(activosFijosCierres.anio), activosFijosCierres.libro);
}
