import { and, eq, lte, gte, sql } from "drizzle-orm";
import { db } from "../client";
import { asientosContables, asientosLineas, planCuentas } from "../schema";
import { listarPlanCuentasDeEmpresa } from "./plan-cuentas";

const redondear = (n: number) => Math.round(n * 100) / 100;
const CLASES_BALANCE = ["Activo", "Pasivo", "Patrimonio"];
const CLASES_RESULTADO = ["Ingresos", "Costos y Gastos"];
const porCodigo = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });
const inicioDeAnio = (fecha: string) => `${fecha.slice(0, 4)}-01-01`;

// ── Balance de 8 columnas ───────────────────────────────────────────────────

export type FilaBalance = {
  cuentaId: string;
  codigo: string;
  nombre: string;
  clase: string;
  debe: number;
  haber: number;
  deudor: number;
  acreedor: number;
  activo: number;
  pasivo: number;
  perdida: number;
  ganancia: number;
};

export type TotalesBalance = Omit<FilaBalance, "cuentaId" | "codigo" | "nombre" | "clase">;

const columnasVacias = (): TotalesBalance => ({
  debe: 0,
  haber: 0,
  deudor: 0,
  acreedor: 0,
  activo: 0,
  pasivo: 0,
  perdida: 0,
  ganancia: 0,
});

/**
 * Balance de 8 columnas (sumas, saldos, inventario, resultados) al `hasta`. Las cuentas de
 * balance acumulan desde el inicio; las de resultado, el ejercicio (año). Solo asientos
 * contabilizados y moneda funcional. Las cuentas de orden solo figuran en sumas y saldos.
 */
export async function balanceOchoColumnas(empresaId: string, hasta: string) {
  const rows = await db
    .select({
      cuentaId: planCuentas.id,
      codigo: planCuentas.codigoCuenta,
      nombre: planCuentas.nombreCuenta,
      clase: planCuentas.clase,
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
    .groupBy(planCuentas.id, planCuentas.codigoCuenta, planCuentas.nombreCuenta, planCuentas.clase)
    .orderBy(planCuentas.codigoCuenta);

  const filas: FilaBalance[] = [...rows].sort((a, b) => porCodigo(a.codigo, b.codigo)).map((r) => {
    const debe = Number(r.debe);
    const haber = Number(r.haber);
    const neto = redondear(debe - haber);
    const deudor = neto > 0 ? neto : 0;
    const acreedor = neto < 0 ? -neto : 0;
    const esBalance = CLASES_BALANCE.includes(r.clase);
    const esResultado = CLASES_RESULTADO.includes(r.clase);
    return {
      cuentaId: r.cuentaId,
      codigo: r.codigo,
      nombre: r.nombre,
      clase: r.clase,
      debe: redondear(debe),
      haber: redondear(haber),
      deudor,
      acreedor,
      activo: esBalance ? deudor : 0,
      pasivo: esBalance ? acreedor : 0,
      perdida: esResultado ? deudor : 0,
      ganancia: esResultado ? acreedor : 0,
    };
  });

  const totales = columnasVacias();
  for (const f of filas) {
    for (const k of Object.keys(totales) as (keyof TotalesBalance)[]) totales[k] = redondear(totales[k] + f[k]);
  }
  // El resultado del ejercicio cuadra ambos bloques: una utilidad se suma a pérdida (resultados) y a pasivo (inventario).
  const resultadoEjercicio = redondear(totales.ganancia - totales.perdida);
  const conResultado = { ...totales };
  if (resultadoEjercicio >= 0) {
    conResultado.perdida = redondear(totales.perdida + resultadoEjercicio);
    conResultado.pasivo = redondear(totales.pasivo + resultadoEjercicio);
  } else {
    conResultado.ganancia = redondear(totales.ganancia - resultadoEjercicio);
    conResultado.activo = redondear(totales.activo - resultadoEjercicio);
  }

  const cuadra = {
    sumas: Math.abs(totales.debe - totales.haber) < 0.01,
    saldos: Math.abs(totales.deudor - totales.acreedor) < 0.01,
    inventario: Math.abs(conResultado.activo - conResultado.pasivo) < 0.01,
    resultados: Math.abs(conResultado.perdida - conResultado.ganancia) < 0.01,
  };
  return { filas, totales, resultadoEjercicio, conResultado, cuadra };
}

// ── Estado de resultados ────────────────────────────────────────────────────

export type FilaResultado = {
  cuentaId: string;
  codigo: string;
  nombre: string;
  nivel: number;
  esTitulo: boolean;
  monto: number;
};

/**
 * Estado de resultados del período `desde`..`hasta`: ingresos (haber − debe) y costos y
 * gastos (debe − haber) en árbol, con los títulos acumulando a sus hijas. Solo asientos
 * contabilizados y moneda funcional.
 */
export async function estadoResultados(empresaId: string, desde: string, hasta: string) {
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
        gte(asientosContables.fecha, desde),
        lte(asientosContables.fecha, hasta),
        sql`${planCuentas.clase} in ('Ingresos', 'Costos y Gastos')`,
      ),
    )
    .groupBy(asientosLineas.cuentaId);
  const propio = new Map(rows.map((r) => [r.cuentaId, { debe: Number(r.debe), haber: Number(r.haber) }]));

  const hijos = new Map<string | null, typeof plan>();
  for (const c of [...plan].sort((a, b) => porCodigo(a.codigoCuenta, b.codigoCuenta))) {
    hijos.set(c.cuentaPadreId, [...(hijos.get(c.cuentaPadreId) ?? []), c]);
  }

  const construir = (clase: "Ingresos" | "Costos y Gastos") => {
    const signo = clase === "Ingresos" ? -1 : 1; // monto positivo del lado natural de la sección
    const filas: FilaResultado[] = [];
    const visitar = (c: (typeof plan)[number], nivel: number): number => {
      const p = propio.get(c.id);
      let monto = p ? signo * (p.debe - p.haber) : 0;
      const hijas = hijos.get(c.id) ?? [];
      const posicion = filas.length;
      filas.push({ cuentaId: c.id, codigo: c.codigoCuenta, nombre: c.nombreCuenta, nivel, esTitulo: hijas.length > 0, monto: 0 });
      for (const h of hijas) monto += visitar(h, nivel + 1);
      monto = redondear(monto);
      filas[posicion]!.monto = monto;
      return monto;
    };
    let total = 0;
    for (const raiz of (hijos.get(null) ?? []).filter((c) => c.clase === clase)) total += visitar(raiz, 0);
    // Solo lo que tiene movimiento (o cuelga de algo que lo tiene).
    return { filas: filas.filter((f) => Math.abs(f.monto) > 0.004), total: redondear(total) };
  };

  const ingresos = construir("Ingresos");
  const gastos = construir("Costos y Gastos");
  return {
    ingresos,
    gastos,
    resultado: redondear(ingresos.total - gastos.total),
  };
}
