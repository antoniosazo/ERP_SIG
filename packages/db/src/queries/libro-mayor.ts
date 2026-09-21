import { and, asc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { asientosContables, asientosLineas, pagos, planCuentas, terceros } from "../schema";
import { listarPlanCuentasDeEmpresa } from "./plan-cuentas";

/** Las cuentas de resultado acumulan el ejercicio (año); las de balance, desde el inicio. */
const CLASES_RESULTADO = ["Ingresos", "Costos y Gastos"] as const;
const esResultado = (clase: string) => (CLASES_RESULTADO as readonly string[]).includes(clase);
const inicioDeAnio = (fecha: string) => `${fecha.slice(0, 4)}-01-01`;
const redondear = (n: number) => Math.round(n * 100) / 100;

type Plan = Awaited<ReturnType<typeof listarPlanCuentasDeEmpresa>>;

/**
 * Saldo como en SAP B1: debe − haber. Un saldo acreedor (pasivos, patrimonio, ingresos)
 * queda negativo, y la suma de todas las cuentas de un ejercicio cuadrado es cero.
 */
const saldoDebeHaber = (debe: number, haber: number) => redondear(debe - haber);

function descendientes(plan: Plan, cuentaId: string): string[] {
  const hijos = new Map<string, string[]>();
  for (const c of plan) {
    if (c.cuentaPadreId) hijos.set(c.cuentaPadreId, [...(hijos.get(c.cuentaPadreId) ?? []), c.id]);
  }
  const salida: string[] = [];
  const visitar = (id: string) => {
    salida.push(id);
    for (const h of hijos.get(id) ?? []) visitar(h);
  };
  visitar(cuentaId);
  return salida;
}

// ── Saldos por cuenta (plan de cuentas) ─────────────────────────────────────

/**
 * Saldo de cada cuenta al `hasta` (inclusive), en moneda funcional y solo con asientos
 * contabilizados. Las cuentas título acumulan a sus hijas. El resultado va en el signo
 * natural de cada cuenta (Deudora: debe − haber; Acreedora: haber − debe).
 */
export async function saldosDelPlan(empresaId: string, hasta: string): Promise<Record<string, number>> {
  const plan = await listarPlanCuentasDeEmpresa(empresaId);
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
        lte(asientosContables.fecha, hasta),
        sql`(${planCuentas.clase} not in ('Ingresos', 'Costos y Gastos') or ${asientosContables.fecha} >= ${inicioDeAnio(hasta)})`,
      ),
    )
    .groupBy(asientosLineas.cuentaId);
  const propio = new Map(rows.map((r) => [r.cuentaId, { debe: Number(r.debe), haber: Number(r.haber) }]));

  const salida: Record<string, number> = {};
  for (const c of plan) {
    let debe = 0;
    let haber = 0;
    for (const id of descendientes(plan, c.id)) {
      const p = propio.get(id);
      if (p) {
        debe += p.debe;
        haber += p.haber;
      }
    }
    salida[c.id] = saldoDebeHaber(debe, haber);
  }
  return salida;
}

// ── Libro mayor de una cuenta ───────────────────────────────────────────────

export type MovimientoMayor = {
  lineaId: string;
  fecha: string;
  correlativo: number;
  asientoId: string;
  glosaAsiento: string;
  glosaLinea: string | null;
  cuentaCodigo: string;
  cuentaNombre: string;
  tercero: string | null;
  debe: number;
  haber: number;
  origenTabla: string | null;
  origenId: string | null;
  /** Solo para pagos: distingue recibido / efectuado al armar el enlace. */
  pagoTipo: string | null;
};

/**
 * Movimientos de una cuenta (y de sus hijas si es un título) entre `desde` y `hasta`,
 * con el saldo inicial. Solo asientos contabilizados, en moneda funcional.
 */
export async function movimientosCuenta(empresaId: string, cuentaId: string, desde: string, hasta: string) {
  const plan = await listarPlanCuentasDeEmpresa(empresaId);
  const cuenta = plan.find((c) => c.id === cuentaId);
  if (!cuenta) return null;
  const ids = descendientes(plan, cuentaId);
  const resultado = esResultado(cuenta.clase);

  const [ini] = await db
    .select({
      debe: sql<string>`coalesce(sum(${asientosLineas.montoDebeFuncional}), 0)`,
      haber: sql<string>`coalesce(sum(${asientosLineas.montoHaberFuncional}), 0)`,
    })
    .from(asientosLineas)
    .innerJoin(asientosContables, eq(asientosContables.id, asientosLineas.asientoId))
    .where(
      and(
        eq(asientosContables.empresaId, empresaId),
        eq(asientosContables.estado, "contabilizado"),
        inArray(asientosLineas.cuentaId, ids),
        lt(asientosContables.fecha, desde),
        ...(resultado ? [gte(asientosContables.fecha, inicioDeAnio(desde))] : []),
      ),
    );
  const saldoInicial = saldoDebeHaber(Number(ini?.debe ?? 0), Number(ini?.haber ?? 0));

  const rows = await db
    .select({
      lineaId: asientosLineas.id,
      fecha: asientosContables.fecha,
      correlativo: asientosContables.correlativo,
      asientoId: asientosContables.id,
      glosaAsiento: asientosContables.glosa,
      glosaLinea: asientosLineas.glosa,
      cuentaCodigo: planCuentas.codigoCuenta,
      cuentaNombre: planCuentas.nombreCuenta,
      tercero: terceros.razonSocial,
      debe: asientosLineas.montoDebeFuncional,
      haber: asientosLineas.montoHaberFuncional,
      origenTabla: asientosContables.documentoOrigenTabla,
      origenId: asientosContables.documentoOrigenId,
    })
    .from(asientosLineas)
    .innerJoin(asientosContables, eq(asientosContables.id, asientosLineas.asientoId))
    .innerJoin(planCuentas, eq(planCuentas.id, asientosLineas.cuentaId))
    .leftJoin(terceros, eq(terceros.id, asientosLineas.terceroId))
    .where(
      and(
        eq(asientosContables.empresaId, empresaId),
        eq(asientosContables.estado, "contabilizado"),
        inArray(asientosLineas.cuentaId, ids),
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
      ),
    )
    .orderBy(asc(asientosContables.fecha), asc(asientosContables.correlativo), asc(asientosLineas.id));

  const idsPagos = [...new Set(rows.filter((r) => r.origenTabla === "pagos" && r.origenId).map((r) => r.origenId!))];
  const tipoPago = new Map<string, string>();
  if (idsPagos.length) {
    const ps = await db.select({ id: pagos.id, tipo: pagos.tipo }).from(pagos).where(inArray(pagos.id, idsPagos));
    for (const p of ps) tipoPago.set(p.id, p.tipo);
  }

  const movimientos: MovimientoMayor[] = rows.map((r) => ({
    ...r,
    debe: Number(r.debe),
    haber: Number(r.haber),
    pagoTipo: r.origenTabla === "pagos" && r.origenId ? (tipoPago.get(r.origenId) ?? null) : null,
  }));
  const totalDebe = redondear(movimientos.reduce((a, m) => a + m.debe, 0));
  const totalHaber = redondear(movimientos.reduce((a, m) => a + m.haber, 0));
  return {
    cuenta,
    incluyeHijas: ids.length > 1,
    saldoInicial,
    movimientos,
    totalDebe,
    totalHaber,
    saldoFinal: redondear(saldoInicial + saldoDebeHaber(totalDebe, totalHaber)),
    reinicioAnual: resultado,
  };
}
