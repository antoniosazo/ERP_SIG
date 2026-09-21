import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { asientosContables, asientosLineas, pagos, planCuentas, terceros } from "../schema";
import { listarDocumentosAbiertos } from "./pagos";
import type { MovimientoMayor } from "./libro-mayor";

const redondear = (n: number) => Math.round(n * 100) / 100;

export type SaldoTercero = { porCobrar: number; porPagar: number };

/**
 * Saldo de cada socio de negocio al `hasta`, tomado de las líneas de asiento que llevan su
 * RUT en las cuentas de tipo Cliente (por cobrar: debe − haber) y Proveedor (por pagar:
 * haber − debe). Incluye documentos, cobros, pagos y anticipos; solo asientos contabilizados.
 */
export async function saldosDeTerceros(empresaId: string, hasta: string): Promise<Record<string, SaldoTercero>> {
  const rows = await db
    .select({
      terceroId: asientosLineas.terceroId,
      tipo: planCuentas.tipoCuenta,
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
        inArray(planCuentas.tipoCuenta, ["Cliente", "Proveedor"]),
        sql`${asientosLineas.terceroId} is not null`,
      ),
    )
    .groupBy(asientosLineas.terceroId, planCuentas.tipoCuenta);

  const salida: Record<string, SaldoTercero> = {};
  for (const r of rows) {
    if (!r.terceroId) continue;
    const s = (salida[r.terceroId] ??= { porCobrar: 0, porPagar: 0 });
    if (r.tipo === "Cliente") s.porCobrar = redondear(s.porCobrar + Number(r.debe) - Number(r.haber));
    else s.porPagar = redondear(s.porPagar + Number(r.haber) - Number(r.debe));
  }
  return salida;
}

export type MovimientoTercero = MovimientoMayor & { tipoCuenta: "Cliente" | "Proveedor" };

/** Cuenta corriente de un socio: saldos, documentos abiertos y movimientos hasta `hasta`. */
export async function cuentaCorrienteTercero(empresaId: string, terceroId: string, hasta: string) {
  const [tercero] = await db
    .select({ id: terceros.id, limiteCredito: terceros.limiteCredito })
    .from(terceros)
    .where(and(eq(terceros.id, terceroId), eq(terceros.empresaId, empresaId)));
  if (!tercero) return null;

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
      tipoCuenta: planCuentas.tipoCuenta,
      debe: asientosLineas.montoDebeFuncional,
      haber: asientosLineas.montoHaberFuncional,
      origenTabla: asientosContables.documentoOrigenTabla,
      origenId: asientosContables.documentoOrigenId,
    })
    .from(asientosLineas)
    .innerJoin(asientosContables, eq(asientosContables.id, asientosLineas.asientoId))
    .innerJoin(planCuentas, eq(planCuentas.id, asientosLineas.cuentaId))
    .where(
      and(
        eq(asientosContables.empresaId, empresaId),
        eq(asientosContables.estado, "contabilizado"),
        eq(asientosLineas.terceroId, terceroId),
        lte(asientosContables.fecha, hasta),
        inArray(planCuentas.tipoCuenta, ["Cliente", "Proveedor"]),
      ),
    )
    .orderBy(asc(asientosContables.fecha), asc(asientosContables.correlativo), asc(asientosLineas.id));

  const idsPagos = [...new Set(rows.filter((r) => r.origenTabla === "pagos" && r.origenId).map((r) => r.origenId!))];
  const tipoPago = new Map<string, string>();
  if (idsPagos.length) {
    const ps = await db.select({ id: pagos.id, tipo: pagos.tipo }).from(pagos).where(inArray(pagos.id, idsPagos));
    for (const p of ps) tipoPago.set(p.id, p.tipo);
  }
  const movimientos: MovimientoTercero[] = rows.map((r) => ({
    lineaId: r.lineaId,
    fecha: r.fecha,
    correlativo: r.correlativo,
    asientoId: r.asientoId,
    glosaAsiento: r.glosaAsiento,
    glosaLinea: r.glosaLinea,
    cuentaCodigo: r.cuentaCodigo,
    cuentaNombre: r.cuentaNombre,
    tercero: null,
    debe: Number(r.debe),
    haber: Number(r.haber),
    origenTabla: r.origenTabla,
    origenId: r.origenId,
    pagoTipo: r.origenTabla === "pagos" && r.origenId ? (tipoPago.get(r.origenId) ?? null) : null,
    tipoCuenta: r.tipoCuenta as "Cliente" | "Proveedor",
  }));

  const saldo: SaldoTercero = { porCobrar: 0, porPagar: 0 };
  for (const m of movimientos) {
    if (m.tipoCuenta === "Cliente") saldo.porCobrar = redondear(saldo.porCobrar + m.debe - m.haber);
    else saldo.porPagar = redondear(saldo.porPagar + m.haber - m.debe);
  }

  const [abiertosVenta, abiertosCompra] = await Promise.all([
    listarDocumentosAbiertos(empresaId, "Recibido", terceroId),
    listarDocumentosAbiertos(empresaId, "Efectuado", terceroId),
  ]);
  const docsPorCobrar = redondear(abiertosVenta.reduce((a, d) => a + d.saldo, 0));
  const docsPorPagar = redondear(abiertosCompra.reduce((a, d) => a + d.saldo, 0));

  return {
    saldo,
    limiteCredito: Number(tercero.limiteCredito),
    movimientos,
    abiertosVenta,
    abiertosCompra,
    // Lo que el saldo contable tiene de más o de menos frente a los documentos abiertos: anticipos y otros.
    anticiposPorCobrar: redondear(saldo.porCobrar - docsPorCobrar),
    anticiposPorPagar: redondear(saldo.porPagar - docsPorPagar),
  };
}
