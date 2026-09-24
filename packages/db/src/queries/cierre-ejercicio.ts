import type { CerrarEjercicioInput } from "@erp/shared";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { asientosContables, asientosLineas, cierresEjercicio, periodosContables, planCuentas } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { siguienteCorrelativoAsiento } from "./asientos";
import { obtenerAsientoCompraContabilizado } from "./documentos-compra";
import { listarPeriodos } from "./periodos";
import { listarPlanCuentasDeEmpresa } from "./plan-cuentas";

const redondear = (n: number) => Math.round(n * 100) / 100;
const CLASES_RESULTADO = ["Ingresos", "Costos y Gastos"] as const;

export type LineaCierre = {
  cuentaId: string;
  codigo: string;
  nombre: string;
  clase: "Ingresos" | "Costos y Gastos";
  /** Saldo del año que la línea de cierre deja en cero (positivo = lo que tenía la cuenta). */
  saldo: number;
};

export type EstadoCierreEjercicio = {
  anio: number;
  /** Null si nunca se cerró; si no, el último intento (puede estar anulado). */
  cierre: {
    id: string;
    estado: "contabilizado" | "anulado";
    cuentaResultadoId: string;
    montoResultado: number;
    asientoId: string | null;
    fechaReapertura: string | null;
    motivoReapertura: string | null;
  } | null;
  /** Motivos por los que no se puede cerrar ahora mismo (vacío = se puede). */
  bloqueos: string[];
  lineas: LineaCierre[];
  totalIngresos: number;
  totalGastos: number;
  resultado: number;
};

/**
 * Calcula (sin escribir nada) qué pasaría al cerrar `anio`: las líneas que zanjarían cada
 * cuenta de Ingresos/Costos y Gastos, el resultado, y por qué no se podría cerrar hoy
 * (períodos abiertos, año anterior sin cerrar, año ya cerrado). Misma lectura que usa
 * `cerrarEjercicio` para validar, así la UI puede mostrar el motivo antes de intentarlo.
 */
export async function estadoCierreEjercicio(empresaId: string, anio: number): Promise<EstadoCierreEjercicio> {
  const bloqueos: string[] = [];
  const periodos = await listarPeriodos(empresaId);
  const delAnio = periodos.filter((p) => p.anio === anio);
  if (delAnio.length < 12) {
    bloqueos.push(`Faltan períodos de ${anio}: genera el ejercicio completo antes de cerrarlo.`);
  } else {
    const abiertos = delAnio.filter((p) => p.estado !== "Bloqueado").map((p) => String(p.mes).padStart(2, "0"));
    if (abiertos.length) bloqueos.push(`Hay meses sin bloquear en ${anio}: ${abiertos.join(", ")}.`);
  }

  const anioAnteriorTienePeriodos = periodos.some((p) => p.anio === anio - 1);
  const [cierreAnterior] = anioAnteriorTienePeriodos
    ? await db
        .select({ estado: cierresEjercicio.estado })
        .from(cierresEjercicio)
        .where(and(eq(cierresEjercicio.empresaId, empresaId), eq(cierresEjercicio.anio, anio - 1)))
    : [];
  if (anioAnteriorTienePeriodos && cierreAnterior?.estado !== "contabilizado") {
    bloqueos.push(`Cierra primero el ejercicio ${anio - 1} (los cierres son secuenciales).`);
  }

  const [cierreRow] = await db
    .select()
    .from(cierresEjercicio)
    .where(and(eq(cierresEjercicio.empresaId, empresaId), eq(cierresEjercicio.anio, anio)));
  if (cierreRow?.estado === "contabilizado") {
    bloqueos.push(`El ejercicio ${anio} ya está cerrado. Reábrelo si necesitas corregirlo.`);
  }

  const plan = await listarPlanCuentasDeEmpresa(empresaId);
  const porId = new Map(plan.map((c) => [c.id, c]));
  const rows = await db
    .select({
      cuentaId: asientosLineas.cuentaId,
      debe: sql<string>`coalesce(sum(${asientosLineas.montoDebeFuncional}), 0)`,
      haber: sql<string>`coalesce(sum(${asientosLineas.montoHaberFuncional}), 0)`,
    })
    .from(asientosLineas)
    .innerJoin(asientosContables, eq(asientosContables.id, asientosLineas.asientoId))
    .innerJoin(planCuentas, eq(planCuentas.id, asientosLineas.cuentaId))
    .where(
      and(
        eq(asientosContables.empresaId, empresaId),
        eq(asientosContables.estado, "contabilizado"),
        gte(asientosContables.fecha, `${anio}-01-01`),
        lte(asientosContables.fecha, `${anio}-12-31`),
        sql`${planCuentas.clase} in ('Ingresos', 'Costos y Gastos')`,
      ),
    )
    .groupBy(asientosLineas.cuentaId);

  const lineas: LineaCierre[] = [];
  for (const r of rows) {
    const c = porId.get(r.cuentaId);
    if (!c) continue;
    const clase = c.clase as "Ingresos" | "Costos y Gastos";
    const saldo = redondear(clase === "Ingresos" ? Number(r.haber) - Number(r.debe) : Number(r.debe) - Number(r.haber));
    if (Math.abs(saldo) < 0.005) continue;
    lineas.push({ cuentaId: c.id, codigo: c.codigoCuenta, nombre: c.nombreCuenta, clase, saldo });
  }
  lineas.sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  const totalIngresos = redondear(lineas.filter((l) => l.clase === "Ingresos").reduce((a, l) => a + l.saldo, 0));
  const totalGastos = redondear(lineas.filter((l) => l.clase === "Costos y Gastos").reduce((a, l) => a + l.saldo, 0));

  return {
    anio,
    cierre: cierreRow
      ? {
          id: cierreRow.id,
          estado: cierreRow.estado,
          cuentaResultadoId: cierreRow.cuentaResultadoId,
          montoResultado: Number(cierreRow.montoResultado),
          asientoId: cierreRow.asientoId,
          fechaReapertura: cierreRow.fechaReapertura,
          motivoReapertura: cierreRow.motivoReapertura,
        }
      : null,
    bloqueos,
    lineas,
    totalIngresos,
    totalGastos,
    resultado: redondear(totalIngresos - totalGastos),
  };
}

export async function cerrarEjercicio(empresaId: string, input: CerrarEjercicioInput, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const estado = await estadoCierreEjercicio(empresaId, input.anio);
    if (estado.bloqueos.length) throw new Error(estado.bloqueos[0]);
    if (estado.lineas.length === 0) throw new Error(`No hay movimientos de resultado en ${input.anio}: nada que cerrar.`);

    const [cuenta] = await tx
      .select()
      .from(planCuentas)
      .where(and(eq(planCuentas.id, input.cuentaResultadoId), eq(planCuentas.empresaId, empresaId)));
    if (!cuenta) throw new Error("La cuenta de resultado no pertenece a esta empresa");
    if (!cuenta.nivelImputable || !cuenta.activa) throw new Error(`La cuenta ${cuenta.codigoCuenta} no está disponible`);
    if (cuenta.clase !== "Patrimonio") throw new Error(`La cuenta ${cuenta.codigoCuenta} debe ser de Patrimonio`);

    const fecha = `${input.anio}-12-31`;
    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, input.anio);
    const [asiento] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha,
        glosa: `Cierre del ejercicio ${input.anio}`,
        tipo: "ajuste",
        origen: "cierre de ejercicio",
        estado: "contabilizado",
        documentoOrigenTabla: "cierres_ejercicio",
      })
      .returning();
    if (!asiento) throw new Error("No se pudo crear el asiento de cierre");

    // Ingreso (crédito) se lleva a 0 debitándolo; Gasto (débito) se lleva a 0 acreditándolo.
    const lineasAsiento = estado.lineas.map((l) => ({
      asientoId: asiento.id,
      cuentaId: l.cuentaId,
      terceroId: null,
      glosa: `Cierre ${input.anio} — ${l.nombre}`,
      montoDebeOrigen: (l.clase === "Ingresos" ? l.saldo : 0).toString(),
      montoHaberOrigen: (l.clase === "Costos y Gastos" ? l.saldo : 0).toString(),
      monedaOrigenId: null as never,
      tipoCambioAplicado: "1",
      montoDebeFuncional: (l.clase === "Ingresos" ? l.saldo : 0).toString(),
      montoHaberFuncional: (l.clase === "Costos y Gastos" ? l.saldo : 0).toString(),
      documentoReferenciaId: asiento.id,
    }));
    // Moneda funcional real de las líneas de contrapartida (todas comparten la misma cuenta,
    // se toma de cualquier línea de asiento contabilizada existente en esas cuentas).
    const [monedaRow] = await tx
      .select({ id: asientosLineas.monedaOrigenId })
      .from(asientosLineas)
      .where(sql`${asientosLineas.cuentaId} = ${estado.lineas[0]!.cuentaId}`)
      .limit(1);
    const monedaFuncionalId = monedaRow!.id;
    for (const l of lineasAsiento) l.monedaOrigenId = monedaFuncionalId as never;

    const resultado = estado.resultado;
    lineasAsiento.push({
      asientoId: asiento.id,
      cuentaId: input.cuentaResultadoId,
      terceroId: null,
      glosa: `Cierre ${input.anio} — ${resultado >= 0 ? "utilidad" : "pérdida"} del ejercicio`,
      montoDebeOrigen: (resultado < 0 ? -resultado : 0).toString(),
      montoHaberOrigen: (resultado >= 0 ? resultado : 0).toString(),
      monedaOrigenId: monedaFuncionalId as never,
      tipoCambioAplicado: "1",
      montoDebeFuncional: (resultado < 0 ? -resultado : 0).toString(),
      montoHaberFuncional: (resultado >= 0 ? resultado : 0).toString(),
      documentoReferenciaId: asiento.id,
    });
    await tx.insert(asientosLineas).values(lineasAsiento);

    const [existente] = await tx
      .select()
      .from(cierresEjercicio)
      .where(and(eq(cierresEjercicio.empresaId, empresaId), eq(cierresEjercicio.anio, input.anio)));
    const valores = {
      cuentaResultadoId: input.cuentaResultadoId,
      montoResultado: resultado.toString(),
      estado: "contabilizado" as const,
      asientoId: asiento.id,
      asientoReversaId: null,
      fechaReapertura: null,
      motivoReapertura: null,
      usuarioId: ctx?.usuarioId ?? null,
      updatedAt: new Date(),
    };
    const [cierre] = existente
      ? await tx.update(cierresEjercicio).set(valores).where(eq(cierresEjercicio.id, existente.id)).returning()
      : await tx.insert(cierresEjercicio).values({ empresaId, anio: input.anio, ...valores }).returning();
    if (!cierre) throw new Error("No se pudo registrar el cierre");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "cierres_ejercicio",
        registroId: cierre.id,
        etiqueta: `Cierre del ejercicio ${input.anio}`,
        accion: existente ? "editar" : "crear",
        despues: { anio: input.anio, resultado, cuenta: cuenta.codigoCuenta, asiento: correlativo, lineas: estado.lineas.length },
      });
    }
    return { cierre, correlativoAsiento: correlativo, resultado };
  });
}

export async function reabrirEjercicio(empresaId: string, anio: number, motivo: string, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const [cierre] = await tx
      .select()
      .from(cierresEjercicio)
      .where(and(eq(cierresEjercicio.empresaId, empresaId), eq(cierresEjercicio.anio, anio)))
      .for("update");
    if (!cierre) throw new Error(`El ejercicio ${anio} no está cerrado`);
    if (cierre.estado !== "contabilizado" || !cierre.asientoId) throw new Error(`El ejercicio ${anio} no está cerrado`);

    // No se puede reabrir un año si el siguiente ya está cerrado (mismo principio secuencial).
    const [siguiente] = await tx
      .select({ estado: cierresEjercicio.estado })
      .from(cierresEjercicio)
      .where(and(eq(cierresEjercicio.empresaId, empresaId), eq(cierresEjercicio.anio, anio + 1)));
    if (siguiente?.estado === "contabilizado") {
      throw new Error(`Reabre primero el ejercicio ${anio + 1} (los cierres son secuenciales).`);
    }

    const original = await tx.select().from(asientosLineas).where(eq(asientosLineas.asientoId, cierre.asientoId));
    const [cab] = await tx.select().from(asientosContables).where(eq(asientosContables.id, cierre.asientoId));
    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
    const [reversa] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha: `${anio}-12-31`,
        glosa: `Reversa: ${cab?.glosa ?? `Cierre del ejercicio ${anio}`}`,
        tipo: "ajuste",
        origen: "reapertura de ejercicio",
        estado: "contabilizado",
        documentoOrigenTabla: "cierres_ejercicio",
      })
      .returning();
    if (!reversa) throw new Error("No se pudo crear el asiento de reversa");
    await tx.insert(asientosLineas).values(
      original.map((l) => ({
        asientoId: reversa.id,
        cuentaId: l.cuentaId,
        centroCostoId: l.centroCostoId,
        terceroId: l.terceroId,
        glosa: `Reversa: ${l.glosa ?? ""}`.trim(),
        montoDebeOrigen: l.montoHaberOrigen,
        montoHaberOrigen: l.montoDebeOrigen,
        monedaOrigenId: l.monedaOrigenId,
        tipoCambioAplicado: l.tipoCambioAplicado,
        montoDebeFuncional: l.montoHaberFuncional,
        montoHaberFuncional: l.montoDebeFuncional,
        documentoReferenciaId: reversa.id,
      })),
    );

    const [act] = await tx
      .update(cierresEjercicio)
      .set({
        estado: "anulado",
        asientoReversaId: reversa.id,
        fechaReapertura: new Date().toISOString().slice(0, 10),
        motivoReapertura: motivo,
        updatedAt: new Date(),
      })
      .where(eq(cierresEjercicio.id, cierre.id))
      .returning();
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { ...ctx, motivo },
        tabla: "cierres_ejercicio",
        registroId: cierre.id,
        etiqueta: `Cierre del ejercicio ${anio}`,
        accion: "cambio_estado",
        antes: { estado: "contabilizado" },
        despues: { estado: "anulado", reversa: correlativo },
      });
    }
    return act!;
  });
}

export async function obtenerCierreConAsiento(empresaId: string, anio: number) {
  const estado = await estadoCierreEjercicio(empresaId, anio);
  const asiento = estado.cierre?.asientoId
    ? await obtenerAsientoCompraContabilizado(estado.cierre.asientoId, empresaId)
    : null;
  const reversa =
    estado.cierre?.estado === "anulado"
      ? await db
          .select({ asientoReversaId: cierresEjercicio.asientoReversaId })
          .from(cierresEjercicio)
          .where(and(eq(cierresEjercicio.empresaId, empresaId), eq(cierresEjercicio.anio, anio)))
      : [];
  const asientoReversaId = reversa[0]?.asientoReversaId;
  const reversaAsiento = asientoReversaId ? await obtenerAsientoCompraContabilizado(asientoReversaId, empresaId) : null;
  return { ...estado, asiento, reversa: reversaAsiento };
}
