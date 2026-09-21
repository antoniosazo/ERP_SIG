import { and, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { documentosCompra, documentosVenta, pagos, pagosDocumentos } from "../schema";

export type SaldoDocumento = {
  total: number;
  notasCredito: number;
  pagado: number;
  saldo: number;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Saldo de facturas / notas de débito: `total − notas de crédito contabilizadas contra el
 * documento − pagos aplicados (de pagos no anulados)`. `tabla` indica si los ids son de
 * documentos de venta (cobros) o de compra (pagos a proveedores).
 */
export async function saldosDocumentos(
  tx: Tx | typeof db,
  empresaId: string,
  tabla: "venta" | "compra",
  ids: string[],
): Promise<Map<string, SaldoDocumento>> {
  const out = new Map<string, SaldoDocumento>();
  if (ids.length === 0) return out;

  const totales = new Map<string, number>();
  const ncs = new Map<string, number>();
  if (tabla === "venta") {
    const docs = await tx
      .select({ id: documentosVenta.id, total: documentosVenta.montoTotal })
      .from(documentosVenta)
      .where(and(eq(documentosVenta.empresaId, empresaId), inArray(documentosVenta.id, ids)));
    for (const d of docs) totales.set(d.id, Number(d.total));
    const notas = await tx
      .select({ ref: documentosVenta.documentoReferenciaId, total: documentosVenta.montoTotal })
      .from(documentosVenta)
      .where(
        and(
          eq(documentosVenta.empresaId, empresaId),
          inArray(documentosVenta.documentoReferenciaId, ids),
          eq(documentosVenta.clase, "Nota de Crédito"),
          eq(documentosVenta.estado, "contabilizado"),
        ),
      );
    for (const n of notas) if (n.ref) ncs.set(n.ref, (ncs.get(n.ref) ?? 0) + Number(n.total));
  } else {
    const docs = await tx
      .select({ id: documentosCompra.id, total: documentosCompra.montoTotal })
      .from(documentosCompra)
      .where(and(eq(documentosCompra.empresaId, empresaId), inArray(documentosCompra.id, ids)));
    for (const d of docs) totales.set(d.id, Number(d.total));
    const notas = await tx
      .select({ ref: documentosCompra.documentoBaseId, total: documentosCompra.montoTotal })
      .from(documentosCompra)
      .where(
        and(
          eq(documentosCompra.empresaId, empresaId),
          inArray(documentosCompra.documentoBaseId, ids),
          eq(documentosCompra.docTipo, "nota_credito"),
          eq(documentosCompra.estado, "contabilizado"),
        ),
      );
    for (const n of notas) if (n.ref) ncs.set(n.ref, (ncs.get(n.ref) ?? 0) + Number(n.total));
  }

  const colDoc = tabla === "venta" ? pagosDocumentos.documentoVentaId : pagosDocumentos.documentoCompraId;
  const aplicados = await tx
    .select({ doc: colDoc, monto: pagosDocumentos.montoAplicado })
    .from(pagosDocumentos)
    .innerJoin(pagos, eq(pagos.id, pagosDocumentos.pagoId))
    .where(and(eq(pagos.empresaId, empresaId), eq(pagos.estado, "contabilizado"), inArray(colDoc, ids)));
  const pagado = new Map<string, number>();
  for (const a of aplicados) if (a.doc) pagado.set(a.doc, (pagado.get(a.doc) ?? 0) + Number(a.monto));

  for (const id of ids) {
    const total = totales.get(id);
    if (total === undefined) continue;
    const nc = ncs.get(id) ?? 0;
    const pg = pagado.get(id) ?? 0;
    out.set(id, { total, notasCredito: nc, pagado: pg, saldo: redondear(total - nc - pg) });
  }
  return out;
}

/** ¿El documento tiene pagos vigentes aplicados? Si es así no se puede anular sin anular el pago. */
export async function tienePagosAplicados(
  tx: Tx | typeof db,
  empresaId: string,
  tabla: "venta" | "compra",
  documentoId: string,
): Promise<boolean> {
  const col = tabla === "venta" ? pagosDocumentos.documentoVentaId : pagosDocumentos.documentoCompraId;
  const rows = await tx
    .select({ id: pagosDocumentos.id })
    .from(pagosDocumentos)
    .innerJoin(pagos, eq(pagos.id, pagosDocumentos.pagoId))
    .where(and(eq(pagos.empresaId, empresaId), eq(pagos.estado, "contabilizado"), eq(col, documentoId)))
    .limit(1);
  return rows.length > 0;
}
