import type { ActivoFijoReglaInicio } from "@erp/shared";

/**
 * Motor de cálculo de depreciación — Módulo de Activo Fijo, Fase 1. Funciones puras
 * (sin acceso a DB), como pide la sección 7 de la especificación: "motor de cálculo
 * como servicio puro". Solo implementa "Lineal sobre valor libro remanente"
 * (recomendado por la propia especificación: absorbe mejoras y cambios de vida útil
 * sin recalcular el pasado) con prorrateo "Inicio de mes" / "Mes siguiente" — los dos
 * que de verdad se usan en Chile. Otro método lanza un error explícito en
 * `packages/db/src/queries/activos-fijos.ts`, no falla en silencio.
 */

function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * Cuántos períodos (meses) de depreciación deberían haber corrido, acumulados, hasta el
 * fin de `(anioPeriodo, mesPeriodo)` inclusive, dada la fecha de inicio y la regla de
 * prorrateo del primer período. 0 si el período es anterior al inicio de depreciación.
 */
export function mesesDepreciablesHasta(
  fechaInicioDep: string,
  reglaInicio: ActivoFijoReglaInicio,
  anioPeriodo: number,
  mesPeriodo: number,
): number {
  const [anioIniStr, mesIniStr] = fechaInicioDep.slice(0, 7).split("-");
  const anioIni = Number(anioIniStr);
  let mesIni = Number(mesIniStr);
  let anioBase = anioIni;

  if (reglaInicio === "Mes siguiente") {
    mesIni += 1;
    if (mesIni > 12) {
      mesIni = 1;
      anioBase += 1;
    }
  } else if (reglaInicio !== "Inicio de mes") {
    throw new Error(`Regla de inicio "${reglaInicio}" no implementada en la Fase 1 (solo Inicio de mes / Mes siguiente).`);
  }

  const meses = (anioPeriodo - anioBase) * 12 + (mesPeriodo - mesIni) + 1;
  return Math.max(0, meses);
}

export type ParametrosCuota = {
  costoDepreciable: number;
  valorResidual: number;
  depAcumuladaAlInicio: number;
  vidaUtilMeses: number;
  mesesTranscurridosAlInicio: number;
};

/**
 * Cuota del período con el método "Lineal sobre valor libro remanente":
 * D_mes = (VL − VR) / r, con VL = costo − dep. acumulada, r = meses restantes.
 * Nunca deja el valor libro por debajo del valor residual (clamp de seguridad) ni
 * devuelve una cuota negativa (activo con vida útil ya agotada devuelve 0, no error).
 */
export function calcularCuotaLineal(p: ParametrosCuota): number {
  const valorLibro = p.costoDepreciable - p.depAcumuladaAlInicio;
  const mesesRestantes = p.vidaUtilMeses - p.mesesTranscurridosAlInicio;
  const maximoDepreciable = Math.max(0, valorLibro - p.valorResidual);
  if (mesesRestantes <= 0 || maximoDepreciable <= 0) return 0;
  const cuota = maximoDepreciable / mesesRestantes;
  return redondear(Math.min(cuota, maximoDepreciable));
}
