import type {
  AplicarCorreccionMonetariaInput,
  GuardarFactorCorreccionMonetariaInput,
  LibroContable,
} from "@erp/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import {
  activosFijos,
  activosFijosDocumentos,
  activosFijosDocumentosLineas,
  activosFijosValoraciones,
  activosFijosValoresPeriodo,
  asientosContables,
  asientosLineas,
  empresas,
  factoresCorreccionMonetaria,
  periodosContables,
} from "../schema";
import { cuadroEvolucion } from "./activos-fijos";
import { resolverCuentaClase } from "./activos-fijos-clases";
import { calcularCuotaLineal, mesesDepreciablesHasta } from "./activos-fijos-motor";
import { siguienteCorrelativoAsiento } from "./asientos";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

const LIBRO_TRIBUTARIO: LibroContable = "Tributario";
const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ── Factores de corrección monetaria (globales, sin bitácora por empresa) ──────

export async function listarFactoresCorreccionMonetaria() {
  return db
    .select()
    .from(factoresCorreccionMonetaria)
    .orderBy(desc(factoresCorreccionMonetaria.anio), desc(factoresCorreccionMonetaria.mes));
}

/** Upsert por `(anio, mes)`. Es una tabla global (el IPC es el mismo para toda empresa), sin bitácora por empresa. */
export async function guardarFactorCorreccionMonetaria(input: GuardarFactorCorreccionMonetariaInput) {
  const [fila] = await db
    .insert(factoresCorreccionMonetaria)
    .values({ anio: input.anio, mes: input.mes, factorPorcentaje: input.factorPorcentaje.toString() })
    .onConflictDoUpdate({
      target: [factoresCorreccionMonetaria.anio, factoresCorreccionMonetaria.mes],
      set: { factorPorcentaje: input.factorPorcentaje.toString(), updatedAt: new Date() },
    })
    .returning();
  if (!fila) throw new Error("No se pudo guardar el factor de corrección monetaria");
  return fila;
}

// ── Corrección monetaria (Fase 3) ───────────────────────────────────────────

export type FilaCorreccionMonetaria = {
  activoId: string;
  codigo: string;
  descripcion: string;
  claseId: string;
  centroCostoId: string | null;
  ajusteCosto: number;
  ajusteDepAcumulada: number;
};

/** Suma de líneas CAP/MEJ del libro Tributario, por activo y mes calendario, para un año. */
async function altasPorActivoYMes(
  empresaId: string,
  activoIds: string[],
  anio: number,
): Promise<Map<string, Map<number, number>>> {
  const filas = await db
    .select({
      activoId: activosFijosDocumentosLineas.activoId,
      mes: sql<number>`extract(month from ${activosFijosDocumentos.fecha})::int`,
      total: sql<string>`coalesce(sum(${activosFijosDocumentosLineas.importe}), 0)`,
    })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.estado, "contabilizado"),
        inArray(activosFijosDocumentos.tipoDoc, ["CAP", "MEJ"]),
        eq(activosFijosDocumentosLineas.libro, LIBRO_TRIBUTARIO),
        inArray(activosFijosDocumentosLineas.activoId, activoIds),
        sql`extract(year from ${activosFijosDocumentos.fecha}) = ${anio}`,
      ),
    )
    .groupBy(activosFijosDocumentosLineas.activoId, sql`extract(month from ${activosFijosDocumentos.fecha})`);

  const mapa = new Map<string, Map<number, number>>();
  for (const f of filas) {
    const porMes = mapa.get(f.activoId) ?? new Map<number, number>();
    porMes.set(f.mes, Number(f.total));
    mapa.set(f.activoId, porMes);
  }
  return mapa;
}

/**
 * Calcula (y opcionalmente contabiliza) la corrección monetaria del libro Tributario de
 * un año: al saldo que venía de años anteriores (costo y dep. acumulada, tomados de
 * `cuadroEvolucion`) se le aplica el factor de diciembre; a cada alta (CAP/MEJ) del año
 * se le aplica el factor de su propio mes — igual criterio que publica la circular del
 * SII. Un factor negativo se trata como 0 (el ajuste nunca reduce el activo). Genera un
 * único documento `CM` con una línea por activo y un asiento consolidado por cuenta
 * (Debe Activo Fijo / Haber Corrección Monetaria por el ajuste de costo; Debe
 * Corrección Monetaria / Haber Depreciación Acumulada por el ajuste de depreciación),
 * mismo patrón de lote que `ejecutarDepreciacion` — no es una operación por activo.
 */
export async function aplicarCorreccionMonetaria(
  empresaId: string,
  input: AplicarCorreccionMonetariaInput,
  ctx?: AuditoriaCtx,
): Promise<{
  anio: number;
  filas: FilaCorreccionMonetaria[];
  totalAjusteCosto: number;
  totalAjusteDepAcumulada: number;
  documentoId?: string;
  asientoId?: string | null;
}> {
  const { anio, modo } = input;

  const [factorDiciembre] = await db
    .select()
    .from(factoresCorreccionMonetaria)
    .where(and(eq(factoresCorreccionMonetaria.anio, anio), eq(factoresCorreccionMonetaria.mes, 12)));
  if (!factorDiciembre) {
    throw new Error(`No hay factor de corrección monetaria cargado para diciembre de ${anio}.`);
  }
  const factoresMensuales = await db
    .select()
    .from(factoresCorreccionMonetaria)
    .where(eq(factoresCorreccionMonetaria.anio, anio));
  const factorPorMes = new Map(factoresMensuales.map((f) => [f.mes, Math.max(0, Number(f.factorPorcentaje))]));
  const factorAnual = Math.max(0, Number(factorDiciembre.factorPorcentaje));

  const activos = await db
    .select({
      id: activosFijos.id,
      codigo: activosFijos.codigo,
      descripcion: activosFijos.descripcion,
      claseId: activosFijos.claseId,
      centroCostoId: activosFijos.centroCostoId,
    })
    .from(activosFijos)
    .innerJoin(
      activosFijosValoraciones,
      and(eq(activosFijosValoraciones.activoId, activosFijos.id), eq(activosFijosValoraciones.libro, LIBRO_TRIBUTARIO)),
    )
    .where(and(eq(activosFijos.empresaId, empresaId), eq(activosFijos.estado, "Activo")));

  const filas: FilaCorreccionMonetaria[] = [];
  if (activos.length > 0) {
    const activoIds = activos.map((a) => a.id);
    const evolucion = await cuadroEvolucion(empresaId, LIBRO_TRIBUTARIO, anio);
    const evolucionPorActivo = new Map(evolucion.map((e) => [e.activoId, e]));
    const altasPorMes = await altasPorActivoYMes(empresaId, activoIds, anio);

    for (const a of activos) {
      const evol = evolucionPorActivo.get(a.id);
      if (!evol || !a.claseId) continue;

      let ajusteCosto = redondear((evol.costoInicial * factorAnual) / 100);
      const porMes = altasPorMes.get(a.id);
      if (porMes) {
        for (const [mes, monto] of porMes) {
          ajusteCosto = redondear(ajusteCosto + (monto * (factorPorMes.get(mes) ?? 0)) / 100);
        }
      }
      const ajusteDepAcumulada = redondear((evol.depAcumuladaInicial * factorAnual) / 100);
      if (ajusteCosto === 0 && ajusteDepAcumulada === 0) continue;

      filas.push({
        activoId: a.id,
        codigo: a.codigo,
        descripcion: a.descripcion,
        claseId: a.claseId,
        centroCostoId: a.centroCostoId,
        ajusteCosto,
        ajusteDepAcumulada,
      });
    }
  }

  const totalAjusteCosto = filas.reduce((s, f) => s + f.ajusteCosto, 0);
  const totalAjusteDepAcumulada = filas.reduce((s, f) => s + f.ajusteDepAcumulada, 0);

  if (modo === "simulacion") {
    return { anio, filas, totalAjusteCosto, totalAjusteDepAcumulada };
  }

  return db.transaction(async (tx) => {
    const [existente] = await tx
      .select({ id: activosFijosDocumentos.id })
      .from(activosFijosDocumentos)
      .where(
        and(
          eq(activosFijosDocumentos.empresaId, empresaId),
          eq(activosFijosDocumentos.tipoDoc, "CM"),
          eq(activosFijosDocumentos.anio, anio),
          eq(activosFijosDocumentos.estado, "contabilizado"),
        ),
      );
    if (existente) {
      throw new Error(`Ya se aplicó corrección monetaria para ${anio}. Anúlala primero si necesitas repetirla.`);
    }

    if (filas.length === 0) {
      return { anio, filas: [], totalAjusteCosto: 0, totalAjusteDepAcumulada: 0, documentoId: "", asientoId: null };
    }

    const [empresa] = await tx
      .select({ monedaFuncionalId: empresas.monedaFuncionalId })
      .from(empresas)
      .where(eq(empresas.id, empresaId));
    if (!empresa) throw new Error("La empresa no existe");

    const [ultimoNumero] = await tx
      .select({ max: sql<number>`coalesce(max(${activosFijosDocumentos.numero}), 0)::int` })
      .from(activosFijosDocumentos)
      .where(
        and(
          eq(activosFijosDocumentos.empresaId, empresaId),
          eq(activosFijosDocumentos.tipoDoc, "CM"),
          eq(activosFijosDocumentos.anio, anio),
        ),
      );
    const numero = (ultimoNumero?.max ?? 0) + 1;
    const fecha = `${anio}-12-31`;
    const glosaDoc = `Corrección monetaria Tributario ${anio}`;

    const [documento] = await tx
      .insert(activosFijosDocumentos)
      .values({
        empresaId,
        numero,
        anio,
        tipoDoc: "CM",
        estado: "borrador",
        libro: LIBRO_TRIBUTARIO,
        fecha,
        fechaContabilizacion: fecha,
        glosa: glosaDoc,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!documento) throw new Error("No se pudo crear el documento de corrección monetaria");

    await tx.insert(activosFijosDocumentosLineas).values(
      filas.map((f, i) => ({
        documentoId: documento.id,
        numeroLinea: i,
        activoId: f.activoId,
        libro: LIBRO_TRIBUTARIO,
        importe: f.ajusteCosto.toString(),
        depAcumuladaRetirada: f.ajusteDepAcumulada.toString(),
        glosa: glosaDoc,
      })),
    );

    const porClave = new Map<
      string,
      { cuentaActivo: string; cuentaDepAcum: string; cuentaCM: string; centroCostoId: string | null; ajusteCosto: number; ajusteDep: number }
    >();
    for (const f of filas) {
      const cuentaActivo = await resolverCuentaClase(tx, empresaId, f.claseId, LIBRO_TRIBUTARIO, "ctaActivo", "activo_fijo");
      const cuentaDepAcum = await resolverCuentaClase(
        tx,
        empresaId,
        f.claseId,
        LIBRO_TRIBUTARIO,
        "ctaDepAcumulada",
        "depreciacion_acumulada",
      );
      const cuentaCM = await resolverCuentaClase(
        tx,
        empresaId,
        f.claseId,
        LIBRO_TRIBUTARIO,
        "ctaCorreccionMonetaria",
        "correccion_monetaria",
      );
      if (!cuentaActivo) throw new Error(`Configura la cuenta de Activo Fijo (clase o regla GENERAL) para el activo ${f.codigo}.`);
      if (!cuentaDepAcum) throw new Error(`Configura la cuenta de Depreciación acumulada (clase o regla GENERAL) para el activo ${f.codigo}.`);
      if (!cuentaCM) throw new Error(`Configura la cuenta de Corrección monetaria (clase o regla GENERAL) para el activo ${f.codigo}.`);

      const clave = `${cuentaActivo}::${cuentaDepAcum}::${cuentaCM}::${f.centroCostoId ?? ""}`;
      const acc = porClave.get(clave) ?? {
        cuentaActivo,
        cuentaDepAcum,
        cuentaCM,
        centroCostoId: f.centroCostoId,
        ajusteCosto: 0,
        ajusteDep: 0,
      };
      acc.ajusteCosto += f.ajusteCosto;
      acc.ajusteDep += f.ajusteDepAcumulada;
      porClave.set(clave, acc);
    }

    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
    const [asiento] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha,
        glosa: glosaDoc,
        tipo: "ajuste",
        origen: "activo fijo",
        libro: LIBRO_TRIBUTARIO,
        estado: "contabilizado",
        documentoOrigenId: documento.id,
        documentoOrigenTabla: "activos_fijos_documentos",
      })
      .returning();
    if (!asiento) throw new Error("No se pudo crear el asiento de corrección monetaria");

    const lineasAsiento: (typeof asientosLineas.$inferInsert)[] = [];
    const nuevaLinea = (cuentaId: string, centroCostoId: string | null, debe: number, haber: number) => ({
      asientoId: asiento.id,
      cuentaId,
      centroCostoId,
      terceroId: null,
      glosa: glosaDoc,
      montoDebeOrigen: debe.toString(),
      montoHaberOrigen: haber.toString(),
      monedaOrigenId: empresa.monedaFuncionalId,
      tipoCambioAplicado: "1",
      montoDebeFuncional: debe.toString(),
      montoHaberFuncional: haber.toString(),
      documentoReferenciaId: documento.id,
    });
    for (const g of porClave.values()) {
      if (g.ajusteCosto !== 0) {
        lineasAsiento.push(nuevaLinea(g.cuentaActivo, g.centroCostoId, g.ajusteCosto, 0));
        lineasAsiento.push(nuevaLinea(g.cuentaCM, null, 0, g.ajusteCosto));
      }
      if (g.ajusteDep !== 0) {
        lineasAsiento.push(nuevaLinea(g.cuentaCM, null, g.ajusteDep, 0));
        lineasAsiento.push(nuevaLinea(g.cuentaDepAcum, null, 0, g.ajusteDep));
      }
    }
    await tx.insert(asientosLineas).values(lineasAsiento);

    await tx
      .update(activosFijosDocumentos)
      .set({ estado: "contabilizado", asientoId: asiento.id, updatedAt: new Date() })
      .where(eq(activosFijosDocumentos.id, documento.id));

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos_documentos",
        registroId: documento.id,
        etiqueta: glosaDoc,
        accion: "crear",
        despues: { documento, totalAjusteCosto, totalAjusteDepAcumulada, activos: filas.length },
      });
    }

    return { anio, filas, totalAjusteCosto, totalAjusteDepAcumulada, documentoId: documento.id, asientoId: asiento.id };
  });
}

// ── Registro DDAN (Fase 3) ───────────────────────────────────────────────────

export type ResultadoDdan = {
  activoId: string;
  anio: number;
  aplica: boolean;
  depAcumuladaAcelerada: number;
  depAcumuladaNormal: number;
  ddanAcumulado: number;
  depEjercicioAcelerada: number;
  depEjercicioNormal: number;
  ddanEjercicio: number;
};

/** Suma de DEP+DEP_MAN del libro Tributario contabilizadas hasta (e incluyendo) `hastaAnio`. */
async function depAcumuladaAceleradaHastaAnio(empresaId: string, activoId: string, hastaAnio: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${activosFijosDocumentosLineas.importe}), 0)` })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.estado, "contabilizado"),
        inArray(activosFijosDocumentos.tipoDoc, ["DEP", "DEP_MAN"]),
        eq(activosFijosDocumentosLineas.libro, LIBRO_TRIBUTARIO),
        eq(activosFijosDocumentosLineas.activoId, activoId),
        sql`${activosFijosDocumentos.anio} <= ${hastaAnio}`,
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * Registro DDAN de un activo a un año: Depreciación Acelerada (la real, ya
 * contabilizada) menos Depreciación Normal (una simulación paralela nunca
 * contabilizada, con la vida útil SII completa en vez de la acelerada) — fórmula
 * oficial del registro DDAN. Solo aplica si la valoración Tributario del activo tiene
 * `regimenDepreciacion = "Acelerada"`; si no, devuelve todo en 0 con `aplica: false`.
 */
export async function calcularDDAN(empresaId: string, activoId: string, anio: number): Promise<ResultadoDdan> {
  const [activo] = await db
    .select({ id: activosFijos.id })
    .from(activosFijos)
    .where(and(eq(activosFijos.id, activoId), eq(activosFijos.empresaId, empresaId)));
  if (!activo) throw new Error("El activo no existe en esta empresa");

  const [valoracion] = await db
    .select()
    .from(activosFijosValoraciones)
    .where(and(eq(activosFijosValoraciones.activoId, activoId), eq(activosFijosValoraciones.libro, LIBRO_TRIBUTARIO)));

  const vacio: ResultadoDdan = {
    activoId,
    anio,
    aplica: false,
    depAcumuladaAcelerada: 0,
    depAcumuladaNormal: 0,
    ddanAcumulado: 0,
    depEjercicioAcelerada: 0,
    depEjercicioNormal: 0,
    ddanEjercicio: 0,
  };
  if (!valoracion || valoracion.regimenDepreciacion !== "Acelerada" || !valoracion.vidaUtilNormalMeses || !valoracion.fechaInicioDep) {
    return vacio;
  }

  // El corte "hasta dónde" NO es diciembre del año pedido a ciegas — es el último
  // período con depreciación Tributaria realmente contabilizada (si `anio` ya cerró,
  // coincide con diciembre; si `anio` está en curso, se detiene donde se detuvo la
  // ejecución real). Sin esto, comparar 12 meses hipotéticos de la normal contra menos
  // meses reales de la acelerada da un DDAN inflado y engañoso.
  const [ultimoPeriodoEjecutado] = await db
    .select({ anio: periodosContables.anio, mes: periodosContables.mes })
    .from(activosFijosValoresPeriodo)
    .innerJoin(periodosContables, eq(activosFijosValoresPeriodo.periodoId, periodosContables.id))
    .where(
      and(
        eq(activosFijosValoresPeriodo.activoId, activoId),
        eq(activosFijosValoresPeriodo.libro, LIBRO_TRIBUTARIO),
        sql`${activosFijosValoresPeriodo.depContabilizada} > 0`,
        sql`${periodosContables.anio} <= ${anio}`,
      ),
    )
    .orderBy(desc(periodosContables.anio), desc(periodosContables.mes))
    .limit(1);
  if (!ultimoPeriodoEjecutado) return { ...vacio, aplica: true };
  const { anio: anioCorte, mes: mesCorte } = ultimoPeriodoEjecutado;

  const depAceleradaFinAnio = await depAcumuladaAceleradaHastaAnio(empresaId, activoId, anio);
  const depAceleradaFinAnioAnterior = await depAcumuladaAceleradaHastaAnio(empresaId, activoId, anio - 1);

  // Costo vigente (no depende del año — es el costo actual del activo; la corrección
  // monetaria ya queda reflejada porque `resumenCostoActivo` la incluye).
  const evolucionAnio = await cuadroEvolucion(empresaId, LIBRO_TRIBUTARIO, anio);
  const filaAnio = evolucionAnio.find((f) => f.activoId === activoId);
  const costoDepreciable = filaAnio ? filaAnio.costoFinal : 0;

  let anioIter = Number(valoracion.fechaInicioDep.slice(0, 4));
  let mesIter = Number(valoracion.fechaInicioDep.slice(5, 7));
  let depNormalAcum = 0;
  let depNormalFinAnioAnterior = 0;
  let iteraciones = 0;
  const LIMITE_ITERACIONES = 1200; // ~100 años, margen de seguridad contra bucles infinitos
  while ((anioIter < anioCorte || (anioIter === anioCorte && mesIter <= mesCorte)) && iteraciones < LIMITE_ITERACIONES) {
    const mesAnterior = mesIter === 1 ? { anio: anioIter - 1, mes: 12 } : { anio: anioIter, mes: mesIter - 1 };
    const mesesTranscurridos = mesesDepreciablesHasta(valoracion.fechaInicioDep, valoracion.reglaInicio, mesAnterior.anio, mesAnterior.mes);
    const cuota = calcularCuotaLineal({
      costoDepreciable,
      valorResidual: Number(valoracion.valorResidual),
      depAcumuladaAlInicio: depNormalAcum,
      vidaUtilMeses: valoracion.vidaUtilNormalMeses,
      mesesTranscurridosAlInicio: mesesTranscurridos,
    });
    depNormalAcum += cuota;
    if (anioIter === anio - 1 && mesIter === 12) depNormalFinAnioAnterior = depNormalAcum;

    mesIter += 1;
    if (mesIter > 12) {
      mesIter = 1;
      anioIter += 1;
    }
    iteraciones += 1;
  }

  const depEjercicioAcelerada = depAceleradaFinAnio - depAceleradaFinAnioAnterior;
  const depEjercicioNormal = depNormalAcum - depNormalFinAnioAnterior;

  return {
    activoId,
    anio,
    aplica: true,
    depAcumuladaAcelerada: depAceleradaFinAnio,
    depAcumuladaNormal: redondear(depNormalAcum),
    ddanAcumulado: redondear(depAceleradaFinAnio - depNormalAcum),
    depEjercicioAcelerada,
    depEjercicioNormal: redondear(depEjercicioNormal),
    ddanEjercicio: redondear(depEjercicioAcelerada - depEjercicioNormal),
  };
}
