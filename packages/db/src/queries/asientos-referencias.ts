import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import { activosFijos, activosFijosDocumentos, activosFijosDocumentosLineas, asientosContables, cheques, cierresEjercicio, depositos, documentosCompra, documentosVenta, pagos, tiposDocumento, terceros, bancos } from "../schema";

export type ReferenciaAsiento = {
  id: string; tabla: string; etiqueta: string; pagoTipo?: string; anio?: number;
};

/** Referencias polimórficas: solo resuelve registros de la empresa, en lotes. */
export async function referenciasDeAsiento(empresaId: string, ids: string[]): Promise<ReferenciaAsiento[]> {
  ids = [...new Set(ids)];
  if (!ids.length) return [];
  const [compras, ventas, cobros, deps, chqs, activos, cierres, asientos] = await Promise.all([
    db.select({ id: documentosCompra.id, folio: documentosCompra.folio, numero: documentosCompra.numeroInterno, tipo: tiposDocumento.nombre }).from(documentosCompra)
      .leftJoin(tiposDocumento, eq(tiposDocumento.id, documentosCompra.tipoDocumentoId))
      .where(and(eq(documentosCompra.empresaId, empresaId), inArray(documentosCompra.id, ids))),
    db.select({ id: documentosVenta.id, folio: documentosVenta.folio, numero: documentosVenta.numeroInterno, clase: documentosVenta.clase }).from(documentosVenta).where(and(eq(documentosVenta.empresaId, empresaId), inArray(documentosVenta.id, ids))),
    db.select({ id: pagos.id, numero: pagos.numeroInterno, tipo: pagos.tipo }).from(pagos).where(and(eq(pagos.empresaId, empresaId), inArray(pagos.id, ids))),
    db.select({ id: depositos.id, numero: depositos.numeroInterno }).from(depositos).where(and(eq(depositos.empresaId, empresaId), inArray(depositos.id, ids))),
    db.select({ id: cheques.id, numero: cheques.numero }).from(cheques).where(and(eq(cheques.empresaId, empresaId), inArray(cheques.id, ids))),
    db.select({ id: activosFijosDocumentos.id, numero: activosFijosDocumentos.numero, tipo: activosFijosDocumentos.tipoDoc, anio: activosFijosDocumentos.anio }).from(activosFijosDocumentos).where(and(eq(activosFijosDocumentos.empresaId, empresaId), inArray(activosFijosDocumentos.id, ids))),
    db.select({ id: cierresEjercicio.id, anio: cierresEjercicio.anio }).from(cierresEjercicio).where(and(eq(cierresEjercicio.empresaId, empresaId), inArray(cierresEjercicio.id, ids))),
    db.select({ id: asientosContables.id, numero: asientosContables.correlativo, anio: asientosContables.anio }).from(asientosContables).where(and(eq(asientosContables.empresaId, empresaId), inArray(asientosContables.id, ids))),
  ]);
  return [
    ...compras.map((d) => ({ id: d.id, tabla: "documentos_compra", etiqueta: `${d.tipo ?? "Compra"} · ${d.folio ? `Folio ${d.folio}` : d.numero ?? "Sin folio"}` })),
    ...ventas.map((d) => ({ id: d.id, tabla: "documentos_venta", etiqueta: `${d.clase} · ${d.folio ? `Folio ${d.folio}` : d.numero ?? "Sin folio"}` })),
    ...cobros.map((d) => ({ id: d.id, tabla: "pagos", etiqueta: `Pago ${d.tipo.toLowerCase()} ${d.numero}`, pagoTipo: d.tipo })),
    ...deps.map((d) => ({ id: d.id, tabla: "depositos", etiqueta: `Depósito ${d.numero}` })),
    ...chqs.map((d) => ({ id: d.id, tabla: "cheques", etiqueta: `Cheque ${d.numero}` })),
    ...activos.map((d) => ({ id: d.id, tabla: "activos_fijos_documentos", etiqueta: `${d.tipo} N° ${d.numero} · ${d.anio}` })),
    ...cierres.map((d) => ({ id: d.id, tabla: "cierres_ejercicio", etiqueta: `Cierre del ejercicio ${d.anio}`, anio: d.anio })),
    ...asientos.map((d) => ({ id: d.id, tabla: "asientos_contables", etiqueta: `Asiento ${d.numero ?? "borrador"} · ${d.anio}` })),
  ];
}

export async function obtenerDocumentoActivoFijoParaConsulta(empresaId: string, documentoId: string) {
  const [documento] = await db.select().from(activosFijosDocumentos).where(and(eq(activosFijosDocumentos.empresaId, empresaId), eq(activosFijosDocumentos.id, documentoId)));
  if (!documento) return null;
  const lineas = await db.select({
    id: activosFijosDocumentosLineas.id, activoId: activosFijos.id, codigo: activosFijos.codigo,
    descripcion: activosFijos.descripcion, libro: activosFijosDocumentosLineas.libro,
    importe: activosFijosDocumentosLineas.importe, glosa: activosFijosDocumentosLineas.glosa,
  }).from(activosFijosDocumentosLineas).innerJoin(activosFijos, eq(activosFijos.id, activosFijosDocumentosLineas.activoId))
    .where(and(eq(activosFijosDocumentosLineas.documentoId, documentoId), eq(activosFijos.empresaId, empresaId)))
    .orderBy(asc(activosFijosDocumentosLineas.numeroLinea));
  return { documento, lineas };
}


export async function obtenerChequeParaConsulta(empresaId: string, chequeId: string) {
  const [row] = await db.select({ cheque: cheques, pagoTipo: pagos.tipo, pagoNumero: pagos.numeroInterno, banco: bancos.nombre, tercero: terceros.razonSocial })
    .from(cheques).innerJoin(pagos, and(eq(pagos.id, cheques.pagoId), eq(pagos.empresaId, empresaId)))
    .leftJoin(bancos, eq(bancos.id, cheques.bancoId))
    .leftJoin(terceros, and(eq(terceros.id, cheques.terceroId), eq(terceros.empresaId, empresaId)))
    .where(and(eq(cheques.empresaId, empresaId), eq(cheques.id, chequeId)));
  return row ?? null;
}
