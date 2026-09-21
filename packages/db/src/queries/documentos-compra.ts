import type {
  CrearDocumentoCompraInput,
  DocumentoCompraTipo,
  GuardarDocumentoCompraInput,
  TraerDesdeDocumentoInput,
} from "@erp/shared";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import {
  asientosContables,
  asientosLineas,
  centrosCosto,
  documentosCompra,
  documentosCompraLineas,
  empresas,
  impuestos,
  monedas,
  planCuentas,
  productos,
  stockMovimientos,
  terceros,
  tercerosGrupos,
  tiposDocumento,
} from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { tienePagosAplicados } from "./pagos-saldos";
import { siguienteCorrelativoAsiento } from "./asientos";
import { resolverCuentaGeneral } from "./reglas-determinacion-cuenta";
import { periodoDe } from "./periodos";
import { sembrarSeriesCompra, siguienteCodigo } from "./series";
import { aplicarEntradaStock, aplicarReversaEntrada } from "./stock";

const redondear = (x: number, decimales: number) => {
  const f = 10 ** decimales;
  return Math.round((x + Number.EPSILON) * f) / f;
};

const sumarDiasISO = (iso: string, dias: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const pesos = (x: number) => Math.round(x).toLocaleString("es-CL");

const etiquetaDoc = (d: { numeroInterno: string | null; docTipo: string; folio: string | null }) =>
  `${d.numeroInterno ?? ""} ${d.docTipo}${d.folio ? ` folio ${d.folio}` : ""}`.trim();

/** Documentos con asiento de gasto/IVA/CxP. */
const ES_FACTURA_COMPRA = new Set<DocumentoCompraTipo>(["factura", "nota_credito", "nota_debito"]);
/** Todos los que generan algún asiento al contabilizar (factura + entrada de mercadería). */
const GENERA_ASIENTO = new Set<DocumentoCompraTipo>([
  "factura",
  "nota_credito",
  "nota_debito",
  "entrada_mercaderia",
]);
/** Compras: se bloquea con "Bloqueado" y también con "Bloqueado excepto ventas". */
const PERIODO_BLOQUEA_COMPRA = new Set(["Bloqueado", "Bloqueado excepto ventas"]);

/**
 * Totales de un documento de compra. Igual que ventas, pero el IVA de una línea con
 * `ivaRecuperable = "No Recuperable"` NO se separa: se suma al neto de la línea (irá a la
 * cuenta de imputación) y se acumula en `ivaNoRecuperable`. "Parcial" v1 = se trata como
 * "Total" (el prorrateo real queda para una iteración posterior).
 */
function calcularTotalesCompra(
  lineas: {
    cantidad: number;
    precioUnitario: number;
    descuentoLineaPct: number;
    esExento: boolean;
    impuestoId: string | null | undefined;
    ivaRecuperable: string | null | undefined;
  }[],
  tasas: Map<string, number>,
  decimales: number,
  descuentoGlobalPct = 0,
) {
  const gFactor = 1 - (descuentoGlobalPct || 0) / 100;
  let neto = 0;
  let exento = 0;
  let totalImp = 0;
  let ivaNoRecuperable = 0;
  const netoPorLinea: number[] = [];
  const impuestoPorLinea: number[] = [];
  for (const l of lineas) {
    const bruto = l.cantidad * l.precioUnitario * (1 - (l.descuentoLineaPct || 0) / 100);
    let netoLinea = redondear(bruto * gFactor, decimales);
    const impBase =
      l.esExento || !l.impuestoId
        ? 0
        : redondear((netoLinea * (tasas.get(l.impuestoId) ?? 0)) / 100, decimales);
    let mImp = impBase;
    if (impBase > 0 && l.ivaRecuperable === "No Recuperable") {
      // El IVA no recuperable engrosa el gasto y no genera fila de IVA.
      netoLinea = redondear(netoLinea + impBase, decimales);
      ivaNoRecuperable += impBase;
      mImp = 0;
    }
    if (l.esExento) exento += netoLinea;
    else neto += netoLinea;
    totalImp += mImp;
    netoPorLinea.push(netoLinea);
    impuestoPorLinea.push(mImp);
  }
  return {
    neto,
    exento,
    totalImp,
    ivaNoRecuperable,
    netoPorLinea,
    impuestoPorLinea,
    total: neto + exento + totalImp,
  };
}

// ── Lecturas ─────────────────────────────────────────────────────────────────

export async function listarDocumentosCompra(
  empresaId: string,
  f: { docTipo?: string; estado?: string; terceroId?: string } = {},
) {
  const cond = [eq(documentosCompra.empresaId, empresaId)];
  if (f.docTipo) cond.push(eq(documentosCompra.docTipo, f.docTipo as never));
  if (f.estado) cond.push(eq(documentosCompra.estado, f.estado as never));
  if (f.terceroId) cond.push(eq(documentosCompra.terceroId, f.terceroId));
  return db
    .select()
    .from(documentosCompra)
    .where(and(...cond))
    .orderBy(desc(documentosCompra.fechaEmision), desc(documentosCompra.createdAt));
}

export async function obtenerDocumentoCompraConLineas(id: string, empresaId: string) {
  const [documento] = await db
    .select()
    .from(documentosCompra)
    .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)));
  if (!documento) return null;
  const lineas = await db
    .select()
    .from(documentosCompraLineas)
    .where(eq(documentosCompraLineas.documentoCompraId, id))
    .orderBy(asc(documentosCompraLineas.numeroLinea));
  let asiento = null;
  if (documento.asientoId) {
    [asiento] = await db
      .select()
      .from(asientosContables)
      .where(eq(asientosContables.id, documento.asientoId));
  }
  return { documento, lineas, asiento: asiento ?? null };
}

/**
 * RUT del proveedor, código de tipo de documento SII y folio de un documento de
 * compra — lo que necesita el Web Service de Aceptación/Reclamo de DTE del SII
 * (`aceptarOReclamarDocumento`/`listarEventosDocumento`). `null` si el documento no
 * existe, o si le falta folio o tipo de documento (p. ej. un pedido interno sin DTE).
 */
export async function obtenerDatosSiiDocumentoCompra(
  documentoCompraId: string,
  empresaId: string,
): Promise<{ rutProveedor: string; codigoSiiDoc: string; folio: string } | null> {
  const [row] = await db
    .select({
      folio: documentosCompra.folio,
      rutProveedor: terceros.rut,
      codigoSiiDoc: tiposDocumento.codigoSii,
    })
    .from(documentosCompra)
    .innerJoin(terceros, eq(documentosCompra.terceroId, terceros.id))
    .innerJoin(tiposDocumento, eq(documentosCompra.tipoDocumentoId, tiposDocumento.id))
    .where(and(eq(documentosCompra.id, documentoCompraId), eq(documentosCompra.empresaId, empresaId)));
  if (!row || !row.folio) return null;
  return { rutProveedor: row.rutProveedor, codigoSiiDoc: row.codigoSiiDoc, folio: row.folio };
}

/**
 * Entradas de mercadería contabilizadas con saldo pendiente de facturar. El valor
 * pendiente es el saldo vivo de la cuenta GR-IR (conciliación).
 */
export async function listarEntradasPendientesFacturar(empresaId: string) {
  const rows = await db
    .select({
      id: documentosCompra.id,
      numeroInterno: documentosCompra.numeroInterno,
      fechaEmision: documentosCompra.fechaEmision,
      terceroId: documentosCompra.terceroId,
      cantidadPendiente: documentosCompraLineas.cantidadPendiente,
      precioUnitario: documentosCompraLineas.precioUnitario,
    })
    .from(documentosCompra)
    .innerJoin(
      documentosCompraLineas,
      eq(documentosCompraLineas.documentoCompraId, documentosCompra.id),
    )
    .where(
      and(
        eq(documentosCompra.empresaId, empresaId),
        eq(documentosCompra.docTipo, "entrada_mercaderia"),
        eq(documentosCompra.estado, "contabilizado"),
      ),
    )
    .orderBy(asc(documentosCompra.fechaEmision));

  const porDoc = new Map<
    string,
    { id: string; numeroInterno: string | null; fechaEmision: string; terceroId: string; valorPendiente: number }
  >();
  for (const r of rows) {
    const acc =
      porDoc.get(r.id) ??
      {
        id: r.id,
        numeroInterno: r.numeroInterno,
        fechaEmision: r.fechaEmision,
        terceroId: r.terceroId,
        valorPendiente: 0,
      };
    acc.valorPendiente += Number(r.cantidadPendiente) * Number(r.precioUnitario);
    porDoc.set(r.id, acc);
  }
  return [...porDoc.values()].filter((d) => d.valorPendiente > 0.000001);
}

/** Líneas con saldo pendiente de un pedido abierto (para el diálogo "Traer a factura"). */
export async function lineasPendientesDeDocumento(empresaId: string, documentoBaseId: string) {
  const [doc] = await db
    .select({ id: documentosCompra.id })
    .from(documentosCompra)
    .where(
      and(eq(documentosCompra.id, documentoBaseId), eq(documentosCompra.empresaId, empresaId)),
    );
  if (!doc) return [];
  return db
    .select()
    .from(documentosCompraLineas)
    .where(
      and(
        eq(documentosCompraLineas.documentoCompraId, documentoBaseId),
        gt(documentosCompraLineas.cantidadPendiente, "0"),
      ),
    )
    .orderBy(asc(documentosCompraLineas.numeroLinea));
}

// ── Alta / guardado ──────────────────────────────────────────────────────────

export async function crearDocumentoCompra(
  empresaId: string,
  input: CrearDocumentoCompraInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [tercero] = await tx
      .select({
        monedaId: terceros.monedaId,
        condicionPagoDias: terceros.condicionPagoDias,
        tipoTercero: terceros.tipoTercero,
        bloqueado: terceros.bloqueado,
      })
      .from(terceros)
      .where(and(eq(terceros.id, input.terceroId), eq(terceros.empresaId, empresaId)));
    if (!tercero) throw new Error("El proveedor no existe en esta empresa");
    if (tercero.tipoTercero !== "Proveedor") {
      throw new Error("El socio de negocio no es un proveedor");
    }
    if (tercero.bloqueado) throw new Error("El proveedor está bloqueado");

    const [monedaEmpresa] = await tx
      .select({ id: monedas.id })
      .from(monedas)
      .where(eq(monedas.empresaId, empresaId))
      .orderBy(asc(monedas.codigo))
      .limit(1);

    await sembrarSeriesCompra(tx, empresaId);
    const numeroInterno = await siguienteCodigo(tx, empresaId, "compra", input.docTipo);
    const hoy = new Date().toISOString().slice(0, 10);
    const [doc] = await tx
      .insert(documentosCompra)
      .values({
        empresaId,
        docTipo: input.docTipo,
        numeroInterno,
        tipoDocumentoId: input.tipoDocumentoId,
        terceroId: input.terceroId,
        fechaEmision: hoy,
        fechaContabilizacion: hoy,
        fechaVencimiento: sumarDiasISO(hoy, tercero.condicionPagoDias ?? 0),
        monedaId: tercero.monedaId ?? monedaEmpresa!.id,
        condicionPagoDias: tercero.condicionPagoDias,
        documentoBaseId: input.documentoBaseId ?? null,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!doc) throw new Error("No se pudo crear el documento");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_compra",
        registroId: doc.id,
        etiqueta: etiquetaDoc(doc),
        accion: "crear",
        despues: doc,
      });
    }
    return doc;
  });
}

export async function guardarDocumentoCompra(
  id: string,
  empresaId: string,
  input: GuardarDocumentoCompraInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(documentosCompra)
      .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)));
    if (!antes) throw new Error("El documento no existe en esta empresa");
    if (antes.estado !== "borrador") {
      throw new Error("Solo se puede editar un documento en borrador");
    }
    if (input.modalidad === "Servicio" && antes.docTipo === "entrada_mercaderia") {
      throw new Error("Una entrada de mercadería no puede ser de tipo Servicio");
    }

    const [moneda] = await tx
      .select({ decimales: monedas.decimales })
      .from(monedas)
      .where(and(eq(monedas.id, input.monedaId), eq(monedas.empresaId, empresaId)));
    if (!moneda) throw new Error("La moneda no pertenece a esta empresa");

    const idsImp = input.lineas.map((l) => l.impuestoId).filter((x): x is string => !!x);
    const tasas = new Map<string, number>();
    if (idsImp.length) {
      const rows = await tx
        .select({ id: impuestos.id, tasa: impuestos.tasa })
        .from(impuestos)
        .where(and(eq(impuestos.empresaId, empresaId), inArray(impuestos.id, idsImp)));
      for (const r of rows) tasas.set(r.id, Number(r.tasa));
    }

    const calc = calcularTotalesCompra(
      input.lineas.map((l) => ({
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        descuentoLineaPct: l.descuentoLineaPct ?? 0,
        esExento: l.esExento,
        impuestoId: l.impuestoId,
        ivaRecuperable: l.ivaRecuperable,
      })),
      tasas,
      moneda.decimales,
      input.descuentoGlobalPct ?? 0,
    );
    const { neto, exento, totalImp, ivaNoRecuperable } = calc;
    const llevaPendiente =
      antes.docTipo === "pedido" || antes.docTipo === "entrada_mercaderia";

    // Si el documento viene de otro (pedido / recepción), las líneas conservan su
    // trazabilidad y su saldo pendiente; solo se editan importes/fechas y no se puede
    // agregar/quitar líneas.
    let previas: (typeof documentosCompraLineas.$inferSelect)[] = [];
    if (antes.documentoBaseId) {
      previas = await tx
        .select()
        .from(documentosCompraLineas)
        .where(eq(documentosCompraLineas.documentoCompraId, id))
        .orderBy(asc(documentosCompraLineas.numeroLinea));
      if (previas.length !== input.lineas.length) {
        throw new Error(
          "Este documento se generó desde otro: no se pueden agregar ni quitar líneas.",
        );
      }
    }

    const lineasCalc = input.lineas.map((l, i) => ({
      documentoCompraId: id,
      numeroLinea: i,
      glosa: l.glosa ?? null,
      productoId:
        input.modalidad === "Servicio" ? null : (previas[i]?.productoId ?? l.productoId ?? null),
      cuentaImputacionId: previas[i]?.cuentaImputacionId ?? l.cuentaImputacionId,
      categoriaContableId: previas[i]?.categoriaContableId ?? l.categoriaContableId ?? null,
      centroCostoId: previas[i]?.centroCostoId ?? l.centroCostoId ?? null,
      impuestoId: l.impuestoId ?? null,
      cantidad: l.cantidad.toString(),
      precioUnitario: l.precioUnitario.toString(),
      descuentoLineaPct: (l.descuentoLineaPct ?? 0).toString(),
      montoNeto: calc.netoPorLinea[i]!.toString(),
      esExento: l.esExento,
      montoImpuesto: calc.impuestoPorLinea[i]!.toString(),
      ivaRecuperable: l.ivaRecuperable ?? null,
      cantidadPendiente: previas[i]
        ? previas[i]!.cantidadPendiente
        : llevaPendiente
          ? l.cantidad.toString()
          : "0",
      documentoBaseLineaId: previas[i]?.documentoBaseLineaId ?? null,
    }));

    await tx
      .delete(documentosCompraLineas)
      .where(eq(documentosCompraLineas.documentoCompraId, id));
    await tx.insert(documentosCompraLineas).values(lineasCalc);

    const [doc] = await tx
      .update(documentosCompra)
      .set({
        modalidad: input.modalidad,
        terceroId: input.terceroId,
        tipoDocumentoId: input.tipoDocumentoId,
        folio: input.folio || null,
        fechaEmision: input.fechaEmision,
        fechaVencimiento: input.fechaVencimiento,
        fechaContabilizacion: input.fechaContabilizacion,
        numAtCard: input.numAtCard || null,
        monedaId: input.monedaId,
        tipoCambio: input.tipoCambio.toString(),
        descuentoGlobalPct: (input.descuentoGlobalPct ?? 0).toString(),
        condicionPagoDias: input.condicionPagoDias ?? null,
        glosa: input.glosa || null,
        montoNeto: neto.toString(),
        montoExento: exento.toString(),
        montoImpuesto: totalImp.toString(),
        montoIvaNoRecuperable: ivaNoRecuperable.toString(),
        montoTotal: (neto + exento + totalImp).toString(),
        updatedAt: new Date(),
      })
      .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)))
      .returning();
    if (!doc) throw new Error("No se pudo guardar el documento");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_compra",
        registroId: doc.id,
        etiqueta: etiquetaDoc(doc),
        accion: "editar",
        antes,
        despues: doc,
      });
    }
    return doc;
  });
}

// ── Pedido: abrir / traer / cerrar ───────────────────────────────────────────

export async function abrirPedidoCompra(id: string, empresaId: string, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documentosCompra)
      .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)));
    if (!doc) throw new Error("El documento no existe en esta empresa");
    if (doc.docTipo !== "pedido") throw new Error("Solo se abren pedidos de compra");
    if (doc.estado !== "borrador") throw new Error("El pedido ya no está en borrador");

    const lineas = await tx
      .select({ id: documentosCompraLineas.id, cantidad: documentosCompraLineas.cantidad })
      .from(documentosCompraLineas)
      .where(eq(documentosCompraLineas.documentoCompraId, id));
    if (lineas.length === 0) throw new Error("El pedido no tiene líneas");
    for (const l of lineas) {
      await tx
        .update(documentosCompraLineas)
        .set({ cantidadPendiente: l.cantidad })
        .where(eq(documentosCompraLineas.id, l.id));
    }

    const [act] = await tx
      .update(documentosCompra)
      .set({ estado: "abierto", updatedAt: new Date() })
      .where(eq(documentosCompra.id, id))
      .returning();
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_compra",
        registroId: id,
        etiqueta: etiquetaDoc(doc),
        accion: "cambio_estado",
        antes: { estado: "borrador" },
        despues: { estado: "abierto" },
      });
    }
    return act!;
  });
}

export async function traerDesdeDocumento(
  empresaId: string,
  input: TraerDesdeDocumentoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [base] = await tx
      .select()
      .from(documentosCompra)
      .where(
        and(
          eq(documentosCompra.id, input.documentoBaseId),
          eq(documentosCompra.empresaId, empresaId),
        ),
      );
    if (!base) throw new Error("El documento base no existe en esta empresa");
    // Un pedido abierto se recibe/factura; una entrada de mercadería contabilizada se factura.
    const baseValida =
      (base.docTipo === "pedido" && base.estado === "abierto") ||
      (base.docTipo === "entrada_mercaderia" && base.estado === "contabilizado");
    if (!baseValida) {
      throw new Error("El documento base no está disponible para traer líneas");
    }

    const baseLineas = await tx
      .select()
      .from(documentosCompraLineas)
      .where(eq(documentosCompraLineas.documentoCompraId, base.id))
      .orderBy(asc(documentosCompraLineas.numeroLinea));
    const porId = new Map(baseLineas.map((l) => [l.id, l]));

    const seleccion = input.lineas.map((s) => {
      const bl = porId.get(s.lineaBaseId);
      if (!bl) throw new Error("Una línea seleccionada no pertenece al documento base");
      const pendiente = Number(bl.cantidadPendiente);
      if (s.cantidad > pendiente + 0.000001) {
        throw new Error(
          `La cantidad (${s.cantidad}) supera el saldo pendiente (${pendiente}) de la línea ${bl.numeroLinea + 1}`,
        );
      }
      return { bl, cantidad: s.cantidad };
    });

    // Cabecera del documento destino, heredando datos comerciales del base.
    await sembrarSeriesCompra(tx, empresaId);
    const numeroInterno = await siguienteCodigo(tx, empresaId, "compra", input.docTipoDestino);
    const hoy = new Date().toISOString().slice(0, 10);
    const [nuevo] = await tx
      .insert(documentosCompra)
      .values({
        empresaId,
        docTipo: input.docTipoDestino,
        numeroInterno,
        tipoDocumentoId: base.tipoDocumentoId,
        terceroId: base.terceroId,
        fechaEmision: hoy,
        fechaContabilizacion: hoy,
        fechaVencimiento: sumarDiasISO(hoy, base.condicionPagoDias ?? 0),
        monedaId: base.monedaId,
        tipoCambio: base.tipoCambio,
        descuentoGlobalPct: base.descuentoGlobalPct,
        condicionPagoDias: base.condicionPagoDias,
        documentoBaseId: base.id,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!nuevo) throw new Error("No se pudo crear el documento");

    // Pedido y entrada de mercadería llevan saldo pendiente aguas abajo.
    const llevaPendiente =
      input.docTipoDestino === "pedido" || input.docTipoDestino === "entrada_mercaderia";
    let i = 0;
    for (const { bl, cantidad } of seleccion) {
      await tx.insert(documentosCompraLineas).values({
        documentoCompraId: nuevo.id,
        numeroLinea: i++,
        glosa: bl.glosa,
        productoId: bl.productoId,
        cuentaImputacionId: bl.cuentaImputacionId,
        categoriaContableId: bl.categoriaContableId,
        centroCostoId: bl.centroCostoId,
        impuestoId: bl.impuestoId,
        cantidad: cantidad.toString(),
        precioUnitario: bl.precioUnitario,
        descuentoLineaPct: bl.descuentoLineaPct,
        montoNeto: "0",
        esExento: bl.esExento,
        montoImpuesto: "0",
        ivaRecuperable: bl.ivaRecuperable,
        cantidadPendiente: llevaPendiente ? cantidad.toString() : "0",
        documentoBaseLineaId: bl.id,
      });
      // Descuenta el saldo pendiente de la línea base.
      await tx
        .update(documentosCompraLineas)
        .set({ cantidadPendiente: (Number(bl.cantidadPendiente) - cantidad).toString() })
        .where(eq(documentosCompraLineas.id, bl.id));
    }

    // Recalcula totales del nuevo documento con sus líneas ya insertadas.
    await recalcularTotales(tx, empresaId, nuevo.id);

    // ¿El documento base quedó sin pendiente? → cerrarlo.
    const restantes = await tx
      .select({ pend: documentosCompraLineas.cantidadPendiente })
      .from(documentosCompraLineas)
      .where(eq(documentosCompraLineas.documentoCompraId, base.id));
    const totalPend = restantes.reduce((a, r) => a + Number(r.pend), 0);
    if (totalPend <= 0.000001) {
      await tx
        .update(documentosCompra)
        .set({ estado: "cerrado", updatedAt: new Date() })
        .where(eq(documentosCompra.id, base.id));
    }

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_compra",
        registroId: nuevo.id,
        etiqueta: etiquetaDoc(nuevo),
        accion: "crear",
        despues: { ...nuevo, documentoBaseId: base.id },
      });
    }
    return nuevo;
  });
}

/** Recalcula montos de cabecera/líneas de un documento (tras un "traer" o edición interna). */
async function recalcularTotales(tx: Tx, empresaId: string, docId: string) {
  const [doc] = await tx
    .select()
    .from(documentosCompra)
    .where(eq(documentosCompra.id, docId));
  if (!doc) return;
  const lineas = await tx
    .select()
    .from(documentosCompraLineas)
    .where(eq(documentosCompraLineas.documentoCompraId, docId))
    .orderBy(asc(documentosCompraLineas.numeroLinea));
  const [moneda] = await tx
    .select({ decimales: monedas.decimales })
    .from(monedas)
    .where(eq(monedas.id, doc.monedaId));
  const idsImp = lineas.map((l) => l.impuestoId).filter((x): x is string => !!x);
  const tasas = new Map<string, number>();
  if (idsImp.length) {
    const rows = await tx
      .select({ id: impuestos.id, tasa: impuestos.tasa })
      .from(impuestos)
      .where(and(eq(impuestos.empresaId, empresaId), inArray(impuestos.id, idsImp)));
    for (const r of rows) tasas.set(r.id, Number(r.tasa));
  }
  const calc = calcularTotalesCompra(
    lineas.map((l) => ({
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      descuentoLineaPct: Number(l.descuentoLineaPct),
      esExento: l.esExento,
      impuestoId: l.impuestoId,
      ivaRecuperable: l.ivaRecuperable,
    })),
    tasas,
    moneda?.decimales ?? 0,
    Number(doc.descuentoGlobalPct),
  );
  for (let i = 0; i < lineas.length; i++) {
    await tx
      .update(documentosCompraLineas)
      .set({
        montoNeto: calc.netoPorLinea[i]!.toString(),
        montoImpuesto: calc.impuestoPorLinea[i]!.toString(),
      })
      .where(eq(documentosCompraLineas.id, lineas[i]!.id));
  }
  await tx
    .update(documentosCompra)
    .set({
      montoNeto: calc.neto.toString(),
      montoExento: calc.exento.toString(),
      montoImpuesto: calc.totalImp.toString(),
      montoIvaNoRecuperable: calc.ivaNoRecuperable.toString(),
      montoTotal: calc.total.toString(),
      updatedAt: new Date(),
    })
    .where(eq(documentosCompra.id, docId));
}

export async function cerrarPedidoCompra(
  id: string,
  empresaId: string,
  opts: { forzar?: boolean } = {},
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documentosCompra)
      .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)));
    if (!doc) throw new Error("El documento no existe en esta empresa");
    if (doc.docTipo !== "pedido") throw new Error("Solo se cierran pedidos de compra");
    if (doc.estado !== "abierto") throw new Error("El pedido no está abierto");

    if (!opts.forzar) {
      const lineas = await tx
        .select({ pend: documentosCompraLineas.cantidadPendiente })
        .from(documentosCompraLineas)
        .where(eq(documentosCompraLineas.documentoCompraId, id));
      const totalPend = lineas.reduce((a, r) => a + Number(r.pend), 0);
      if (totalPend > 0.000001) {
        throw new Error("El pedido tiene cantidades pendientes; ciérralo forzando el cierre.");
      }
    }

    const [act] = await tx
      .update(documentosCompra)
      .set({ estado: "cerrado", updatedAt: new Date() })
      .where(eq(documentosCompra.id, id))
      .returning();
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_compra",
        registroId: id,
        etiqueta: etiquetaDoc(doc),
        accion: "cambio_estado",
        antes: { estado: "abierto" },
        despues: { estado: "cerrado" },
      });
    }
    return act!;
  });
}

// ── Contabilización ──────────────────────────────────────────────────────────

type FilaAsiento = {
  cuentaId: string;
  centroCostoId: string | null;
  terceroId: string | null;
  glosa: string;
  debe: number;
  haber: number;
};

type AsientoCompraConstruido = {
  doc: typeof documentosCompra.$inferSelect;
  fechaContab: string;
  glosaCabecera: string;
  filas: FilaAsiento[];
  errores: string[];
  totalDebe: number;
  totalHaber: number;
  cuadra: boolean;
};

/**
 * Arma (sin escribir) el asiento de una factura / NC / ND de compra, acumulando problemas
 * en `errores`. Gasto consolidado por (cuenta, centro); IVA Crédito por cuenta; cuenta
 * puente del proveedor por el total.
 */
async function construirAsientoCompra(
  tx: Tx,
  empresaId: string,
  docId: string,
): Promise<AsientoCompraConstruido> {
  const errores: string[] = [];
  const [doc] = await tx
    .select()
    .from(documentosCompra)
    .where(and(eq(documentosCompra.id, docId), eq(documentosCompra.empresaId, empresaId)));
  if (!doc) throw new Error("El documento no existe");
  if (!ES_FACTURA_COMPRA.has(doc.docTipo)) {
    throw new Error("Este tipo de documento no genera asiento de factura");
  }

  const fechaContab = doc.fechaContabilizacion ?? doc.fechaEmision;
  const periodo = await periodoDe(empresaId, fechaContab);
  if (!periodo) {
    errores.push("No hay un periodo contable para la fecha de contabilización. Genera el ejercicio.");
  } else if (PERIODO_BLOQUEA_COMPRA.has(periodo.estado)) {
    errores.push(
      `El periodo ${periodo.anio}-${String(periodo.mes).padStart(2, "0")} está bloqueado para compras.`,
    );
  }

  const lineas = await tx
    .select()
    .from(documentosCompraLineas)
    .where(eq(documentosCompraLineas.documentoCompraId, docId))
    .orderBy(asc(documentosCompraLineas.numeroLinea));
  if (lineas.length === 0) errores.push("El documento no tiene líneas.");

  // ¿De qué documento viene cada línea? Las que vienen de una Entrada de Mercadería
  // cargan contra GR-IR (el stock/costo ya se movió allí).
  const baseLineaIds = [
    ...new Set(lineas.map((l) => l.documentoBaseLineaId).filter((x): x is string => !!x)),
  ];
  const desdeGrpo = new Set<string>();
  if (baseLineaIds.length) {
    const bases = await tx
      .select({ lineaId: documentosCompraLineas.id, docTipo: documentosCompra.docTipo })
      .from(documentosCompraLineas)
      .innerJoin(
        documentosCompra,
        eq(documentosCompraLineas.documentoCompraId, documentosCompra.id),
      )
      .where(inArray(documentosCompraLineas.id, baseLineaIds));
    for (const b of bases) if (b.docTipo === "entrada_mercaderia") desdeGrpo.add(b.lineaId);
  }
  const lineaEsDesdeGrpo = (l: (typeof lineas)[number]) =>
    !!l.documentoBaseLineaId && desdeGrpo.has(l.documentoBaseLineaId);

  const necesitaGrIr = lineas.some(lineaEsDesdeGrpo);
  const cuentaGrIr = necesitaGrIr
    ? await resolverCuentaGeneral(tx, empresaId, "compra", "gr_ir")
    : null;
  if (necesitaGrIr && !cuentaGrIr) {
    errores.push("Configura la cuenta puente GR-IR en Determinación de cuentas.");
  }

  // RN-A: una línea de producto de inventario que NO viene de un GRPO se rechaza
  // (las compras de inventario pasan por una Entrada de Mercadería).
  const idsProd = [...new Set(lineas.map((l) => l.productoId).filter((x): x is string => !!x))];
  const esInventarioPorId = new Map<string, boolean>();
  if (idsProd.length) {
    const prods = await tx
      .select({
        id: productos.id,
        esInventario: productos.esInventario,
        esCompra: productos.esCompra,
        codigo: productos.codigo,
      })
      .from(productos)
      .where(inArray(productos.id, idsProd));
    for (const p of prods) esInventarioPorId.set(p.id, p.esInventario);
    const esCompraPorId = new Map(prods.map((p) => [p.id, p.esCompra]));
    for (const l of lineas) {
      if (!l.productoId) continue;
      const cod = prods.find((p) => p.id === l.productoId)?.codigo ?? "";
      if (esCompraPorId.get(l.productoId) === false) {
        errores.push(`El artículo ${cod} no está habilitado para compra.`);
      }
      if (esInventarioPorId.get(l.productoId) && !lineaEsDesdeGrpo(l)) {
        errores.push(
          `El artículo ${cod} es de inventario: usa una Entrada de Mercadería y luego "Traer a factura".`,
        );
      }
    }
  }

  const [empresa] = await tx
    .select({ monedaFuncionalId: empresas.monedaFuncionalId })
    .from(empresas)
    .where(eq(empresas.id, empresaId));

  const [tercero] = await tx.select().from(terceros).where(eq(terceros.id, doc.terceroId));
  // Cuenta puente: 1) del proveedor, 2) de su grupo de socios de negocio, 3) fallback
  // GENERAL de "Determinación de cuentas".
  const grupoTercero = tercero?.grupoId
    ? (await tx.select().from(tercerosGrupos).where(eq(tercerosGrupos.id, tercero.grupoId)))[0]
    : undefined;
  const cuentaPuente =
    tercero?.cuentaContableAsociadaId ??
    grupoTercero?.cuentaContableAsociadaId ??
    (await resolverCuentaGeneral(tx, empresaId, "compra", "cuenta_por_pagar"));
  if (!cuentaPuente) {
    errores.push(
      "El proveedor no tiene cuenta puente, su grupo tampoco, y no hay regla GENERAL de cuenta por pagar.",
    );
  }

  // Cuenta de IVA crédito por impuesto usado.
  const idsImp = [...new Set(lineas.map((l) => l.impuestoId).filter((x): x is string => !!x))];
  const cuentaImpuesto = new Map<string, string>();
  if (idsImp.length) {
    const rows = await tx
      .select({ id: impuestos.id, cuenta: impuestos.cuentaContableId, tipo: impuestos.tipo })
      .from(impuestos)
      .where(and(eq(impuestos.empresaId, empresaId), inArray(impuestos.id, idsImp)));
    for (const r of rows) {
      let cuenta = r.cuenta ?? "";
      if (!cuenta && r.tipo === "IVA Crédito") {
        cuenta = (await resolverCuentaGeneral(tx, empresaId, "impuesto", "iva_credito")) ?? "";
      }
      cuentaImpuesto.set(r.id, cuenta);
    }
  }

  const esCredito = doc.docTipo === "nota_credito";
  const glosaCabecera =
    `${doc.docTipo} ${doc.folio ?? doc.numeroInterno ?? ""} — ${tercero?.razonSocial ?? ""}`.trim() ||
    doc.docTipo;
  const filas: FilaAsiento[] = [];

  // Cargo consolidado por cuenta + centro de costo. Las líneas que vienen de un GRPO
  // cargan contra GR-IR (cancela el transitorio); el resto, contra su cuenta de imputación.
  const gastoPorClave = new Map<
    string,
    { cuentaId: string; centroCostoId: string | null; monto: number }
  >();
  for (const l of lineas) {
    const monto = Number(l.montoNeto);
    if (monto === 0) continue;
    const cuentaId = lineaEsDesdeGrpo(l) ? cuentaGrIr! : l.cuentaImputacionId;
    const centro = lineaEsDesdeGrpo(l) ? null : l.centroCostoId;
    const clave = `${cuentaId}::${centro ?? ""}`;
    const acc =
      gastoPorClave.get(clave) ?? { cuentaId, centroCostoId: centro, monto: 0 };
    acc.monto += monto;
    gastoPorClave.set(clave, acc);
  }
  for (const g of gastoPorClave.values()) {
    filas.push({
      cuentaId: g.cuentaId,
      centroCostoId: g.centroCostoId,
      terceroId: null,
      glosa: glosaCabecera,
      debe: esCredito ? 0 : g.monto,
      haber: esCredito ? g.monto : 0,
    });
  }

  // IVA crédito consolidado por cuenta.
  const ivaPorCuenta = new Map<string, number>();
  for (const l of lineas) {
    const imp = Number(l.montoImpuesto);
    if (imp === 0) continue;
    const cuenta = l.impuestoId ? cuentaImpuesto.get(l.impuestoId) : "";
    if (!cuenta) {
      errores.push("Un impuesto usado no tiene cuenta contable asignada.");
      continue;
    }
    ivaPorCuenta.set(cuenta, (ivaPorCuenta.get(cuenta) ?? 0) + imp);
  }
  for (const [cuenta, monto] of ivaPorCuenta) {
    filas.push({
      cuentaId: cuenta,
      centroCostoId: null,
      terceroId: null,
      glosa: "IVA Crédito Fiscal",
      debe: esCredito ? 0 : monto,
      haber: esCredito ? monto : 0,
    });
  }

  // Cuenta por pagar (puente del proveedor) por el total.
  if (cuentaPuente) {
    filas.push({
      cuentaId: cuentaPuente,
      centroCostoId: null,
      terceroId: tercero?.id ?? null,
      glosa: glosaCabecera,
      debe: esCredito ? Number(doc.montoTotal) : 0,
      haber: esCredito ? 0 : Number(doc.montoTotal),
    });
  }

  // Validación de las cuentas usadas (RN-01 imputable, RN-02 control, RN-06 moneda).
  const cuentaIds = [...new Set(filas.map((f) => f.cuentaId))];
  if (cuentaIds.length) {
    const rows = await tx
      .select({
        id: planCuentas.id,
        codigo: planCuentas.codigoCuenta,
        clase: planCuentas.clase,
        tipoCuenta: planCuentas.tipoCuenta,
        nivelImputable: planCuentas.nivelImputable,
        requiereAnalisisTerceros: planCuentas.requiereAnalisisTerceros,
        modoMoneda: planCuentas.modoMoneda,
        monedaFijaId: planCuentas.monedaFijaId,
        activa: planCuentas.activa,
      })
      .from(planCuentas)
      .where(and(eq(planCuentas.empresaId, empresaId), inArray(planCuentas.id, cuentaIds)));
    const cta = new Map(rows.map((r) => [r.id, r]));
    for (const f of filas) {
      const c = cta.get(f.cuentaId);
      if (!c) {
        errores.push("Una cuenta del asiento no pertenece a esta empresa.");
        continue;
      }
      const etq = `${c.codigo}`;
      if (!c.activa) errores.push(`La cuenta ${etq} está inactiva.`);
      if (!c.nivelImputable) errores.push(`La cuenta ${etq} no es imputable (es de agrupación).`);
      if (c.requiereAnalisisTerceros && !f.terceroId) {
        errores.push(`La cuenta de control ${etq} exige un tercero en la línea.`);
      }
      // La cuenta puente del proveedor debe ser Pasivo/Proveedor — si alguien la cambió
      // directo en la base de datos (el selector de la ficha del tercero ya filtra esto),
      // el asiento quedaría con la cuenta por pagar mal clasificada.
      if (f.cuentaId === cuentaPuente && (c.clase !== "Pasivo" || c.tipoCuenta !== "Proveedor")) {
        errores.push(`La cuenta puente del proveedor (${etq}) debe ser de tipo Pasivo/Proveedor.`);
      }
      if (c.modoMoneda === "Funcional" || c.modoMoneda === "Local") {
        if (empresa && doc.monedaId !== empresa.monedaFuncionalId) {
          errores.push(`La cuenta ${etq} solo admite la moneda funcional.`);
        }
      } else if (c.modoMoneda === "Extranjera fija") {
        if (doc.monedaId !== c.monedaFijaId) {
          errores.push(`La cuenta ${etq} está fijada a otra moneda.`);
        }
      }
    }
  }

  const totalDebe = filas.reduce((a, f) => a + f.debe, 0);
  const totalHaber = filas.reduce((a, f) => a + f.haber, 0);
  const cuadra = Math.abs(totalDebe - totalHaber) <= 0.01;
  if (filas.length > 0 && !cuadra) {
    errores.push(`Asiento descuadrado: debe ${pesos(totalDebe)} ≠ haber ${pesos(totalHaber)}`);
  }

  return { doc, fechaContab, glosaCabecera, filas, errores, totalDebe, totalHaber, cuadra };
}

async function persistirAsientoCompra(
  tx: Tx,
  empresaId: string,
  built: AsientoCompraConstruido,
  meta: { tipo: "egreso" | "traspaso"; origen: string } = { tipo: "egreso", origen: "compra" },
) {
  const { doc, fechaContab, glosaCabecera, filas } = built;
  const tc = Number(doc.tipoCambio);
  const anio = Number(fechaContab.slice(0, 4));
  const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
  const [asiento] = await tx
    .insert(asientosContables)
    .values({
      empresaId,
      correlativo,
      fecha: fechaContab,
      glosa: glosaCabecera,
      tipo: meta.tipo,
      origen: meta.origen,
      estado: "contabilizado",
      documentoOrigenId: doc.id,
      documentoOrigenTabla: "documentos_compra",
    })
    .returning();
  if (!asiento) throw new Error("No se pudo crear el asiento");

  await tx.insert(asientosLineas).values(
    filas.map((f) => ({
      asientoId: asiento.id,
      cuentaId: f.cuentaId,
      centroCostoId: f.centroCostoId,
      terceroId: f.terceroId,
      glosa: f.glosa,
      montoDebeOrigen: f.debe.toString(),
      montoHaberOrigen: f.haber.toString(),
      monedaOrigenId: doc.monedaId,
      tipoCambioAplicado: tc.toString(),
      montoDebeFuncional: (f.debe * tc).toString(),
      montoHaberFuncional: (f.haber * tc).toString(),
      documentoReferenciaId: doc.id,
    })),
  );
  return { asiento, correlativo };
}

async function generarAsientoCompra(tx: Tx, empresaId: string, docId: string) {
  const built = await construirAsientoCompra(tx, empresaId, docId);
  if (built.errores.length) throw new Error(built.errores[0]);
  return persistirAsientoCompra(tx, empresaId, built);
}

// ── Entrada de Mercadería (GRPO): stock + costo + asiento Existencias / GR-IR ──

/** Construye el asiento de una Entrada de Mercadería (sin escribir). */
async function construirAsientoEntradaMercaderia(
  tx: Tx,
  empresaId: string,
  docId: string,
): Promise<AsientoCompraConstruido & { lineasInventario: { productoId: string; cantidad: number; costoUnitario: number; cuentaId: string; centroCostoId: string | null }[] }> {
  const errores: string[] = [];
  const [doc] = await tx
    .select()
    .from(documentosCompra)
    .where(and(eq(documentosCompra.id, docId), eq(documentosCompra.empresaId, empresaId)));
  if (!doc) throw new Error("El documento no existe");
  if (doc.docTipo !== "entrada_mercaderia") throw new Error("No es una entrada de mercadería");

  const fechaContab = doc.fechaContabilizacion ?? doc.fechaEmision;
  const periodo = await periodoDe(empresaId, fechaContab);
  if (!periodo) {
    errores.push("No hay un periodo contable para la fecha de contabilización. Genera el ejercicio.");
  } else if (PERIODO_BLOQUEA_COMPRA.has(periodo.estado)) {
    errores.push(
      `El periodo ${periodo.anio}-${String(periodo.mes).padStart(2, "0")} está bloqueado para compras.`,
    );
  }

  const lineas = await tx
    .select()
    .from(documentosCompraLineas)
    .where(eq(documentosCompraLineas.documentoCompraId, docId))
    .orderBy(asc(documentosCompraLineas.numeroLinea));

  const idsProd = [...new Set(lineas.map((l) => l.productoId).filter((x): x is string => !!x))];
  const esInventarioPorId = new Map<string, boolean>();
  if (idsProd.length) {
    const prods = await tx
      .select({
        id: productos.id,
        esInventario: productos.esInventario,
        esCompra: productos.esCompra,
        codigo: productos.codigo,
      })
      .from(productos)
      .where(inArray(productos.id, idsProd));
    for (const p of prods) {
      esInventarioPorId.set(p.id, p.esInventario);
      if (!p.esCompra) errores.push(`El artículo ${p.codigo} no está habilitado para compra.`);
    }
  }

  const lineasInventario = lineas
    .filter((l) => l.productoId && esInventarioPorId.get(l.productoId))
    .map((l) => ({
      productoId: l.productoId!,
      cantidad: Number(l.cantidad),
      costoUnitario: Number(l.precioUnitario),
      cuentaId: l.cuentaImputacionId,
      centroCostoId: l.centroCostoId,
    }));
  if (lineasInventario.length === 0) {
    errores.push("La entrada de mercadería no tiene líneas de producto de inventario.");
  }

  const cuentaGrIr = await resolverCuentaGeneral(tx, empresaId, "compra", "gr_ir");
  if (!cuentaGrIr) {
    errores.push("Configura la cuenta puente GR-IR en Determinación de cuentas.");
  }

  const [tercero] = await tx.select().from(terceros).where(eq(terceros.id, doc.terceroId));
  const [empresa] = await tx
    .select({ monedaFuncionalId: empresas.monedaFuncionalId })
    .from(empresas)
    .where(eq(empresas.id, empresaId));

  const glosaCabecera =
    `Entrada ${doc.numeroInterno ?? ""} — ${tercero?.razonSocial ?? ""}`.trim() || "Entrada de mercadería";

  const filas: FilaAsiento[] = [];
  const existenciasPorClave = new Map<
    string,
    { cuentaId: string; centroCostoId: string | null; monto: number }
  >();
  let totalExistencias = 0;
  for (const l of lineasInventario) {
    const monto = redondear(l.cantidad * l.costoUnitario, 4);
    totalExistencias += monto;
    const clave = `${l.cuentaId}::${l.centroCostoId ?? ""}`;
    const acc =
      existenciasPorClave.get(clave) ??
      { cuentaId: l.cuentaId, centroCostoId: l.centroCostoId, monto: 0 };
    acc.monto += monto;
    existenciasPorClave.set(clave, acc);
  }
  for (const g of existenciasPorClave.values()) {
    filas.push({
      cuentaId: g.cuentaId,
      centroCostoId: g.centroCostoId,
      terceroId: null,
      glosa: glosaCabecera,
      debe: g.monto,
      haber: 0,
    });
  }
  if (cuentaGrIr && totalExistencias > 0) {
    filas.push({
      cuentaId: cuentaGrIr,
      centroCostoId: null,
      terceroId: null,
      glosa: "Provisión GR-IR",
      debe: 0,
      haber: redondear(totalExistencias, 4),
    });
  }

  // Validación de cuentas usadas (RN-01 imputable / RN-06 moneda).
  const cuentaIds = [...new Set(filas.map((f) => f.cuentaId))];
  if (cuentaIds.length) {
    const rows = await tx
      .select({
        id: planCuentas.id,
        codigo: planCuentas.codigoCuenta,
        nivelImputable: planCuentas.nivelImputable,
        modoMoneda: planCuentas.modoMoneda,
        monedaFijaId: planCuentas.monedaFijaId,
        activa: planCuentas.activa,
      })
      .from(planCuentas)
      .where(and(eq(planCuentas.empresaId, empresaId), inArray(planCuentas.id, cuentaIds)));
    const cta = new Map(rows.map((r) => [r.id, r]));
    for (const f of filas) {
      const c = cta.get(f.cuentaId);
      if (!c) {
        errores.push("Una cuenta del asiento no pertenece a esta empresa.");
        continue;
      }
      if (!c.activa) errores.push(`La cuenta ${c.codigo} está inactiva.`);
      if (!c.nivelImputable) errores.push(`La cuenta ${c.codigo} no es imputable.`);
      if (c.modoMoneda === "Funcional" || c.modoMoneda === "Local") {
        if (empresa && doc.monedaId !== empresa.monedaFuncionalId) {
          errores.push(`La cuenta ${c.codigo} solo admite la moneda funcional.`);
        }
      } else if (c.modoMoneda === "Extranjera fija" && doc.monedaId !== c.monedaFijaId) {
        errores.push(`La cuenta ${c.codigo} está fijada a otra moneda.`);
      }
    }
  }

  const totalDebe = filas.reduce((a, f) => a + f.debe, 0);
  const totalHaber = filas.reduce((a, f) => a + f.haber, 0);
  const cuadra = Math.abs(totalDebe - totalHaber) <= 0.01;
  if (filas.length > 0 && !cuadra) {
    errores.push(`Asiento descuadrado: debe ${pesos(totalDebe)} ≠ haber ${pesos(totalHaber)}`);
  }

  return {
    doc,
    fechaContab,
    glosaCabecera,
    filas,
    errores,
    totalDebe,
    totalHaber,
    cuadra,
    lineasInventario,
  };
}

export async function vistaPreviaAsientoCompra(empresaId: string, docId: string) {
  return db.transaction(async (tx) => {
    const built = await construirAsientoCompra(tx, empresaId, docId);
    const cuentaIds = [...new Set(built.filas.map((f) => f.cuentaId))];
    const centroIds = [
      ...new Set(built.filas.map((f) => f.centroCostoId).filter((x): x is string => !!x)),
    ];
    const cuentasMap = new Map<string, string>();
    if (cuentaIds.length) {
      const rows = await tx
        .select({
          id: planCuentas.id,
          codigo: planCuentas.codigoCuenta,
          nombre: planCuentas.nombreCuenta,
        })
        .from(planCuentas)
        .where(inArray(planCuentas.id, cuentaIds));
      for (const r of rows) cuentasMap.set(r.id, `${r.codigo} — ${r.nombre}`);
    }
    const centrosMap = new Map<string, string>();
    if (centroIds.length) {
      const rows = await tx
        .select({ id: centrosCosto.id, codigo: centrosCosto.codigo, nombre: centrosCosto.nombre })
        .from(centrosCosto)
        .where(inArray(centrosCosto.id, centroIds));
      for (const r of rows) centrosMap.set(r.id, `${r.codigo} — ${r.nombre}`);
    }
    return {
      modo: "previa" as const,
      glosa: built.glosaCabecera,
      fecha: built.fechaContab,
      lineas: built.filas.map((f) => ({
        cuenta: cuentasMap.get(f.cuentaId) ?? f.cuentaId,
        centroCosto: f.centroCostoId ? (centrosMap.get(f.centroCostoId) ?? null) : null,
        glosa: f.glosa,
        debe: f.debe,
        haber: f.haber,
      })),
      totalDebe: built.totalDebe,
      totalHaber: built.totalHaber,
      cuadra: built.cuadra,
      errores: built.errores,
    };
  });
}

export async function obtenerAsientoCompraContabilizado(asientoId: string, empresaId: string) {
  const [cab] = await db
    .select()
    .from(asientosContables)
    .where(and(eq(asientosContables.id, asientoId), eq(asientosContables.empresaId, empresaId)));
  if (!cab) return null;
  const rows = await db
    .select({
      glosa: asientosLineas.glosa,
      debe: asientosLineas.montoDebeOrigen,
      haber: asientosLineas.montoHaberOrigen,
      cuentaCodigo: planCuentas.codigoCuenta,
      cuentaNombre: planCuentas.nombreCuenta,
      centroCodigo: centrosCosto.codigo,
      centroNombre: centrosCosto.nombre,
      terceroCodigo: terceros.codigo,
      terceroNombre: terceros.razonSocial,
    })
    .from(asientosLineas)
    .leftJoin(planCuentas, eq(asientosLineas.cuentaId, planCuentas.id))
    .leftJoin(centrosCosto, eq(asientosLineas.centroCostoId, centrosCosto.id))
    .leftJoin(terceros, eq(asientosLineas.terceroId, terceros.id))
    .where(eq(asientosLineas.asientoId, asientoId));

  const lineas = rows.map((r) => ({
    cuenta: r.terceroNombre
      ? `${r.terceroCodigo ?? ""} ${r.terceroNombre}`.trim()
      : `${r.cuentaCodigo ?? ""} — ${r.cuentaNombre ?? ""}`.trim(),
    centroCosto:
      r.centroCodigo != null ? `${r.centroCodigo} — ${r.centroNombre ?? ""}`.trim() : null,
    glosa: r.glosa,
    debe: Number(r.debe),
    haber: Number(r.haber),
  }));
  const totalDebe = lineas.reduce((a, l) => a + l.debe, 0);
  const totalHaber = lineas.reduce((a, l) => a + l.haber, 0);
  return {
    modo: "real" as const,
    correlativo: cab.correlativo,
    fecha: cab.fecha,
    glosa: cab.glosa,
    tipo: cab.tipo,
    origen: cab.origen,
    estado: cab.estado,
    lineas,
    totalDebe,
    totalHaber,
    cuadra: Math.abs(totalDebe - totalHaber) <= 0.01,
    errores: [] as string[],
  };
}

export async function contabilizarDocumentoCompra(
  id: string,
  empresaId: string,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [prev] = await tx
      .select({ estado: documentosCompra.estado, docTipo: documentosCompra.docTipo })
      .from(documentosCompra)
      .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)));
    if (!prev) throw new Error("El documento no existe");
    if (prev.estado !== "borrador") throw new Error("El documento ya no está en borrador");
    if (!GENERA_ASIENTO.has(prev.docTipo)) throw new Error("Este tipo de documento no se contabiliza");

    // ── Entrada de Mercadería: mueve stock + costo, asiento Existencias / GR-IR ──
    if (prev.docTipo === "entrada_mercaderia") {
      const built = await construirAsientoEntradaMercaderia(tx, empresaId, id);
      if (built.errores.length) throw new Error(built.errores[0]);
      for (const l of built.lineasInventario) {
        await aplicarEntradaStock(tx, empresaId, l.productoId, {
          cantidad: l.cantidad,
          costoUnitario: l.costoUnitario,
          fecha: built.fechaContab,
          origenTabla: "documentos_compra",
          origenId: id,
          glosa: built.glosaCabecera,
        });
      }
      const { asiento: asi, correlativo: corr } = await persistirAsientoCompra(tx, empresaId, built, {
        tipo: "traspaso",
        origen: "entrada mercadería",
      });
      await tx
        .update(stockMovimientos)
        .set({ asientoId: asi.id })
        .where(
          and(
            eq(stockMovimientos.origenTabla, "documentos_compra"),
            eq(stockMovimientos.origenId, id),
            eq(stockMovimientos.tipo, "entrada"),
          ),
        );
      const [docEm] = await tx
        .update(documentosCompra)
        .set({
          estado: "contabilizado",
          asientoId: asi.id,
          usuarioContabilizacionId: ctx?.usuarioId ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)))
        .returning();
      if (ctx) {
        await registrarAuditoria(tx, {
          empresaId,
          ctx,
          tabla: "documentos_compra",
          registroId: id,
          etiqueta: etiquetaDoc(docEm!),
          accion: "cambio_estado",
          antes: { estado: "borrador" },
          despues: { estado: "contabilizado", asiento: corr },
        });
      }
      return docEm!;
    }

    const { asiento, correlativo } = await generarAsientoCompra(tx, empresaId, id);
    const [doc] = await tx
      .update(documentosCompra)
      .set({
        estado: "contabilizado",
        asientoId: asiento.id,
        usuarioContabilizacionId: ctx?.usuarioId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)))
      .returning();
    if (!doc) throw new Error("No se pudo contabilizar el documento");

    // Si vino de un pedido y este ya no tiene pendiente → cerrarlo.
    if (doc.documentoBaseId) {
      const [base] = await tx
        .select({ id: documentosCompra.id, estado: documentosCompra.estado })
        .from(documentosCompra)
        .where(eq(documentosCompra.id, doc.documentoBaseId));
      if (base && base.estado === "abierto") {
        const pend = await tx
          .select({ p: documentosCompraLineas.cantidadPendiente })
          .from(documentosCompraLineas)
          .where(eq(documentosCompraLineas.documentoCompraId, base.id));
        if (pend.reduce((a, r) => a + Number(r.p), 0) <= 0.000001) {
          await tx
            .update(documentosCompra)
            .set({ estado: "cerrado", updatedAt: new Date() })
            .where(eq(documentosCompra.id, base.id));
        }
      }
    }

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_compra",
        registroId: doc.id,
        etiqueta: etiquetaDoc(doc),
        accion: "cambio_estado",
        antes: { estado: "borrador" },
        despues: { estado: "contabilizado", asiento: correlativo },
      });
    }
    return doc;
  });
}

export async function anularDocumentoCompra(
  id: string,
  empresaId: string,
  motivo: string,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documentosCompra)
      .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)));
    if (!doc) throw new Error("El documento no existe en esta empresa");
    if (doc.estado === "anulado") throw new Error("El documento ya está anulado");
    if (await tienePagosAplicados(tx, empresaId, "compra", id)) {
      throw new Error("El documento tiene pagos aplicados: anula primero el pago.");
    }

    // Entrada de Mercadería: no se puede anular si ya se facturó parte, y hay que
    // revertir los movimientos de stock antes de la reversa del asiento.
    if (doc.docTipo === "entrada_mercaderia") {
      const misLineas = await tx
        .select({
          cantidad: documentosCompraLineas.cantidad,
          pendiente: documentosCompraLineas.cantidadPendiente,
        })
        .from(documentosCompraLineas)
        .where(eq(documentosCompraLineas.documentoCompraId, id));
      if (misLineas.some((l) => Number(l.pendiente) < Number(l.cantidad) - 0.000001)) {
        throw new Error(
          "No se puede anular: hay mercadería ya facturada. Anula primero la factura.",
        );
      }
      const movs = await tx
        .select({ id: stockMovimientos.id })
        .from(stockMovimientos)
        .where(
          and(
            eq(stockMovimientos.empresaId, empresaId),
            eq(stockMovimientos.origenTabla, "documentos_compra"),
            eq(stockMovimientos.origenId, id),
            eq(stockMovimientos.tipo, "entrada"),
          ),
        );
      const hoy = new Date().toISOString().slice(0, 10);
      for (const m of movs) await aplicarReversaEntrada(tx, empresaId, m.id, hoy);
    }

    if (doc.estado === "contabilizado" && doc.asientoId) {
      const fechaContab = doc.fechaContabilizacion ?? doc.fechaEmision;
      const periodo = await periodoDe(empresaId, fechaContab);
      if (periodo && PERIODO_BLOQUEA_COMPRA.has(periodo.estado)) {
        throw new Error("El periodo del documento está bloqueado; reábrelo para anular.");
      }
      const original = await tx
        .select()
        .from(asientosLineas)
        .where(eq(asientosLineas.asientoId, doc.asientoId));
      const [cab] = await tx
        .select()
        .from(asientosContables)
        .where(eq(asientosContables.id, doc.asientoId));
      const anio = Number(fechaContab.slice(0, 4));
      const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
      const [reversa] = await tx
        .insert(asientosContables)
        .values({
          empresaId,
          correlativo,
          fecha: fechaContab,
          glosa: `Reversa: ${cab?.glosa ?? etiquetaDoc(doc)}`,
          tipo: "ajuste",
          origen: "anulación compra",
          estado: "contabilizado",
          documentoOrigenId: id,
          documentoOrigenTabla: "documentos_compra",
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
          documentoReferenciaId: id,
        })),
      );
    }

    // Devuelve el saldo a las líneas del documento base.
    const lineas = await tx
      .select({
        cantidad: documentosCompraLineas.cantidad,
        baseLineaId: documentosCompraLineas.documentoBaseLineaId,
      })
      .from(documentosCompraLineas)
      .where(eq(documentosCompraLineas.documentoCompraId, id));
    for (const l of lineas) {
      if (!l.baseLineaId) continue;
      const [bl] = await tx
        .select({ pend: documentosCompraLineas.cantidadPendiente })
        .from(documentosCompraLineas)
        .where(eq(documentosCompraLineas.id, l.baseLineaId));
      if (bl) {
        await tx
          .update(documentosCompraLineas)
          .set({ cantidadPendiente: (Number(bl.pend) + Number(l.cantidad)).toString() })
          .where(eq(documentosCompraLineas.id, l.baseLineaId));
      }
    }
    if (doc.documentoBaseId) {
      const [base] = await tx
        .select({ docTipo: documentosCompra.docTipo, estado: documentosCompra.estado })
        .from(documentosCompra)
        .where(eq(documentosCompra.id, doc.documentoBaseId));
      if (base && base.estado === "cerrado") {
        await tx
          .update(documentosCompra)
          .set({
            estado: base.docTipo === "pedido" ? "abierto" : "contabilizado",
            updatedAt: new Date(),
          })
          .where(eq(documentosCompra.id, doc.documentoBaseId));
      }
    }

    const [act] = await tx
      .update(documentosCompra)
      .set({ estado: "anulado", motivoAnulacion: motivo, updatedAt: new Date() })
      .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)))
      .returning();
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { ...ctx, motivo },
        tabla: "documentos_compra",
        registroId: id,
        etiqueta: etiquetaDoc(doc),
        accion: "cambio_estado",
        antes: { estado: doc.estado },
        despues: { estado: "anulado" },
      });
    }
    return act!;
  });
}

/**
 * Fechas editables de una factura ya contabilizada: vencimiento y contabilización. Mover la
 * fecha de contabilización mueve también la fecha del asiento; el correlativo del asiento es
 * anual, así que solo se admite dentro del mismo año y entre períodos abiertos.
 */
export async function actualizarFechasDocumentoCompra(
  id: string,
  empresaId: string,
  input: { fechaVencimiento: string; fechaContabilizacion: string },
  ctx?: AuditoriaCtx,
) {
  const [antes] = await db
    .select()
    .from(documentosCompra)
    .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)));
  if (!antes) throw new Error("El documento no existe en esta empresa");
  if (antes.estado !== "contabilizado" || !antes.asientoId) {
    throw new Error("Solo se editan las fechas de un documento contabilizado");
  }
  if (input.fechaVencimiento < antes.fechaEmision) {
    throw new Error("La fecha de vencimiento no puede ser anterior a la de emisión");
  }
  const actual = antes.fechaContabilizacion ?? antes.fechaEmision;
  const mueveAsiento = input.fechaContabilizacion !== actual;
  if (mueveAsiento) {
    if (input.fechaContabilizacion.slice(0, 4) !== actual.slice(0, 4)) {
      throw new Error("La fecha de contabilización debe quedar en el mismo año (el correlativo del asiento es anual)");
    }
    for (const [fecha, cual] of [[actual, "actual"], [input.fechaContabilizacion, "nueva"]] as const) {
      const per = await periodoDe(empresaId, fecha);
      if (!per) throw new Error(`No hay un período contable para la fecha de contabilización ${cual}.`);
      if (PERIODO_BLOQUEA_COMPRA.has(per.estado)) {
        throw new Error(
          `El período ${per.anio}-${String(per.mes).padStart(2, "0")} (fecha ${cual}) está bloqueado para compras.`,
        );
      }
    }
  }

  return db.transaction(async (tx) => {
    if (mueveAsiento) {
      await tx
        .update(asientosContables)
        .set({ fecha: input.fechaContabilizacion, updatedAt: new Date() })
        .where(and(eq(asientosContables.id, antes.asientoId!), eq(asientosContables.empresaId, empresaId)));
    }
    const [doc] = await tx
      .update(documentosCompra)
      .set({
        fechaVencimiento: input.fechaVencimiento,
        fechaContabilizacion: input.fechaContabilizacion,
        updatedAt: new Date(),
      })
      .where(and(eq(documentosCompra.id, id), eq(documentosCompra.empresaId, empresaId)))
      .returning();
    if (!doc) throw new Error("No se pudo actualizar el documento");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_compra",
        registroId: doc.id,
        etiqueta: etiquetaDoc(doc),
        accion: "editar",
        antes: { fechaVencimiento: antes.fechaVencimiento, fechaContabilizacion: antes.fechaContabilizacion },
        despues: { fechaVencimiento: doc.fechaVencimiento, fechaContabilizacion: doc.fechaContabilizacion },
      });
    }
    return doc;
  });
}
