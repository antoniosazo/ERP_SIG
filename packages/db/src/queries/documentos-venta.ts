import type {
  CrearDocumentoVentaInput,
  GuardarDocumentoVentaInput,
} from "@erp/shared";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import {
  asientosContables,
  asientosLineas,
  centrosCosto,
  documentosVenta,
  documentosVentaLineas,
  empresas,
  impuestos,
  monedas,
  planCuentas,
  productos,
  productosGrupos,
  stockMovimientos,
  terceros,
  tercerosGrupos,
} from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { tienePagosAplicados } from "./pagos-saldos";
import { siguienteCorrelativoAsiento } from "./asientos";
import { resolverCuentaGeneral } from "./reglas-determinacion-cuenta";
import { periodoDe } from "./periodos";
import { siguienteCodigo } from "./series";
import {
  aplicarEntradaStock,
  aplicarReversaEntrada,
  aplicarReversaSalida,
  aplicarSalidaStock,
  obtenerStock,
} from "./stock";

const redondear = (x: number, decimales: number) => {
  const f = 10 ** decimales;
  return Math.round((x + Number.EPSILON) * f) / f;
};

/** Suma `dias` a una fecha `YYYY-MM-DD` en UTC y devuelve el mismo formato. */
const sumarDiasISO = (iso: string, dias: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const pesos = (x: number) => Math.round(x).toLocaleString("es-CL");

const etiquetaDoc = (d: { numeroInterno: string | null; clase: string; folio: string | null }) =>
  `${d.numeroInterno ?? ""} ${d.clase}${d.folio ? ` folio ${d.folio}` : ""}`.trim();

/**
 * A partir de líneas con `cantidad × precioUnitario`, su descuento de línea y el
 * descuento global de la cabecera: neto por línea (post‑descuentos, redondeado a
 * `decimales`), su impuesto, y los totales de cabecera. `netoPorLinea[i]` /
 * `impuestoPorLinea[i]` corresponden a `lineas[i]`.
 */
function calcularTotalesVenta(
  lineas: {
    cantidad: number;
    precioUnitario: number;
    descuentoLineaPct: number;
    esExento: boolean;
    impuestoId: string | null | undefined;
  }[],
  tasas: Map<string, number>,
  decimales: number,
  descuentoGlobalPct = 0,
) {
  const gFactor = 1 - (descuentoGlobalPct || 0) / 100;
  let neto = 0;
  let exento = 0;
  let totalImp = 0;
  const netoPorLinea: number[] = [];
  const impuestoPorLinea: number[] = [];
  for (const l of lineas) {
    const bruto = l.cantidad * l.precioUnitario * (1 - (l.descuentoLineaPct || 0) / 100);
    const netoLinea = redondear(bruto * gFactor, decimales);
    const mImp =
      l.esExento || !l.impuestoId
        ? 0
        : redondear((netoLinea * (tasas.get(l.impuestoId) ?? 0)) / 100, decimales);
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
    netoPorLinea,
    impuestoPorLinea,
    total: neto + exento + totalImp,
  };
}

/**
 * Saldo de una factura disponible para notas de crédito:
 * `montoTotal factura − Σ montoTotal de NC contabilizadas contra ella`.
 * Devuelve `null` si el documento no es una factura contabilizada de la empresa.
 */
async function saldoNotaCreditoDeFactura(
  tx: Tx,
  empresaId: string,
  facturaId: string,
  opts: { excluirDocId?: string } = {},
): Promise<number | null> {
  const [factura] = await tx
    .select({
      montoTotal: documentosVenta.montoTotal,
      clase: documentosVenta.clase,
      estado: documentosVenta.estado,
    })
    .from(documentosVenta)
    .where(and(eq(documentosVenta.id, facturaId), eq(documentosVenta.empresaId, empresaId)));
  if (!factura || factura.clase !== "Factura" || factura.estado !== "contabilizado") return null;

  const ncs = await tx
    .select({ id: documentosVenta.id, montoTotal: documentosVenta.montoTotal })
    .from(documentosVenta)
    .where(
      and(
        eq(documentosVenta.empresaId, empresaId),
        eq(documentosVenta.documentoReferenciaId, facturaId),
        eq(documentosVenta.clase, "Nota de Crédito"),
        eq(documentosVenta.estado, "contabilizado"),
      ),
    );
  const consumido = ncs
    .filter((n) => n.id !== opts.excluirDocId)
    .reduce((a, n) => a + Number(n.montoTotal), 0);
  return Number(factura.montoTotal) - consumido;
}

// ── Lecturas ─────────────────────────────────────────────────────────────────

export async function listarDocumentosVenta(
  empresaId: string,
  f: { clase?: string; estado?: string; terceroId?: string; desde?: string; hasta?: string } = {},
) {
  const cond = [eq(documentosVenta.empresaId, empresaId)];
  if (f.clase) cond.push(eq(documentosVenta.clase, f.clase as never));
  if (f.estado) cond.push(eq(documentosVenta.estado, f.estado as never));
  if (f.terceroId) cond.push(eq(documentosVenta.terceroId, f.terceroId));
  if (f.desde) cond.push(gte(documentosVenta.fechaEmision, f.desde));
  if (f.hasta) cond.push(lte(documentosVenta.fechaEmision, f.hasta));
  return db
    .select()
    .from(documentosVenta)
    .where(and(...cond))
    .orderBy(desc(documentosVenta.fechaEmision), desc(documentosVenta.createdAt));
}

export async function obtenerDocumentoVentaConLineas(id: string, empresaId: string) {
  const [documento] = await db
    .select()
    .from(documentosVenta)
    .where(and(eq(documentosVenta.id, id), eq(documentosVenta.empresaId, empresaId)));
  if (!documento) return null;
  const lineas = await db
    .select()
    .from(documentosVentaLineas)
    .where(eq(documentosVentaLineas.documentoVentaId, id))
    .orderBy(asc(documentosVentaLineas.numeroLinea));
  let asiento = null;
  if (documento.asientoId) {
    [asiento] = await db
      .select()
      .from(asientosContables)
      .where(eq(asientosContables.id, documento.asientoId));
  }
  return { documento, lineas, asiento: asiento ?? null };
}

/** Notas de crédito (cualquier estado) que referencian una factura. */
export async function notasCreditoDeFactura(empresaId: string, facturaId: string) {
  return db
    .select({
      id: documentosVenta.id,
      numeroInterno: documentosVenta.numeroInterno,
      folio: documentosVenta.folio,
      fechaEmision: documentosVenta.fechaEmision,
      montoTotal: documentosVenta.montoTotal,
      estado: documentosVenta.estado,
    })
    .from(documentosVenta)
    .where(
      and(
        eq(documentosVenta.empresaId, empresaId),
        eq(documentosVenta.documentoReferenciaId, facturaId),
        eq(documentosVenta.clase, "Nota de Crédito"),
      ),
    )
    .orderBy(desc(documentosVenta.fechaEmision), desc(documentosVenta.createdAt));
}

/**
 * Saldo para notas de crédito de cada factura contabilizada de la empresa
 * (`montoTotal − Σ NC contabilizadas`). Para poblar el formulario y el botón "Emitir NC".
 */
export async function saldosNotaCreditoPorFactura(
  empresaId: string,
): Promise<Record<string, number>> {
  const facturas = await db
    .select({ id: documentosVenta.id, montoTotal: documentosVenta.montoTotal })
    .from(documentosVenta)
    .where(
      and(
        eq(documentosVenta.empresaId, empresaId),
        eq(documentosVenta.clase, "Factura"),
        eq(documentosVenta.estado, "contabilizado"),
      ),
    );
  if (facturas.length === 0) return {};
  const ncs = await db
    .select({
      ref: documentosVenta.documentoReferenciaId,
      montoTotal: documentosVenta.montoTotal,
    })
    .from(documentosVenta)
    .where(
      and(
        eq(documentosVenta.empresaId, empresaId),
        eq(documentosVenta.clase, "Nota de Crédito"),
        eq(documentosVenta.estado, "contabilizado"),
      ),
    );
  const consumido = new Map<string, number>();
  for (const n of ncs) {
    if (!n.ref) continue;
    consumido.set(n.ref, (consumido.get(n.ref) ?? 0) + Number(n.montoTotal));
  }
  const out: Record<string, number> = {};
  for (const f of facturas) out[f.id] = Number(f.montoTotal) - (consumido.get(f.id) ?? 0);
  return out;
}

// ── Alta ─────────────────────────────────────────────────────────────────────

export async function crearDocumentoVenta(
  empresaId: string,
  input: CrearDocumentoVentaInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    // Moneda funcional de la empresa por defecto.
    const [tercero] = await tx
      .select({
        monedaId: terceros.monedaId,
        condicionPagoDias: terceros.condicionPagoDias,
        razonSocial: terceros.razonSocial,
      })
      .from(terceros)
      .where(and(eq(terceros.id, input.terceroId), eq(terceros.empresaId, empresaId)));
    if (!tercero) throw new Error("El cliente no existe en esta empresa");

    const [monedaEmpresa] = await tx
      .select({ id: monedas.id })
      .from(monedas)
      .where(eq(monedas.empresaId, empresaId))
      .orderBy(asc(monedas.codigo))
      .limit(1);

    const numeroInterno = await siguienteCodigo(tx, empresaId, "venta", "documento");
    const hoy = new Date().toISOString().slice(0, 10);
    const [doc] = await tx
      .insert(documentosVenta)
      .values({
        empresaId,
        numeroInterno,
        clase: input.clase,
        tipoDocumentoId: input.tipoDocumentoId,
        terceroId: input.terceroId,
        fechaEmision: hoy,
        fechaContabilizacion: hoy,
        fechaVencimiento: sumarDiasISO(hoy, tercero.condicionPagoDias ?? 0),
        monedaId: tercero.monedaId ?? monedaEmpresa!.id,
        nombreCliente: tercero.razonSocial,
        condicionPagoDias: tercero.condicionPagoDias,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!doc) throw new Error("No se pudo crear el documento");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_venta",
        registroId: doc.id,
        etiqueta: etiquetaDoc(doc),
        accion: "crear",
        despues: doc,
      });
    }
    return doc;
  });
}

// ── Guardado (borrador) ──────────────────────────────────────────────────────

export async function guardarDocumentoVenta(
  id: string,
  empresaId: string,
  input: GuardarDocumentoVentaInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(documentosVenta)
      .where(and(eq(documentosVenta.id, id), eq(documentosVenta.empresaId, empresaId)));
    if (!antes) throw new Error("El documento no existe en esta empresa");
    if (antes.estado !== "borrador") {
      throw new Error("Solo se puede editar un documento en borrador");
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

    const calc = calcularTotalesVenta(
      input.lineas.map((l) => ({
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        descuentoLineaPct: l.descuentoLineaPct ?? 0,
        esExento: l.esExento,
        impuestoId: l.impuestoId,
      })),
      tasas,
      moneda.decimales,
      input.descuentoGlobalPct ?? 0,
    );
    const { neto, exento, totalImp } = calc;
    const lineasCalc = input.lineas.map((l, i) => ({
      documentoVentaId: id,
      numeroLinea: i,
      glosa: l.glosa ?? null,
      productoId: input.modalidad === "Servicio" ? null : (l.productoId ?? null),
      cuentaIngresoId: l.cuentaIngresoId,
      categoriaContableId: l.categoriaContableId ?? null,
      centroCostoId: l.centroCostoId ?? null,
      impuestoId: l.impuestoId ?? null,
      cantidad: l.cantidad.toString(),
      precioUnitario: l.precioUnitario.toString(),
      descuentoLineaPct: (l.descuentoLineaPct ?? 0).toString(),
      montoNeto: calc.netoPorLinea[i]!.toString(),
      esExento: l.esExento,
      montoImpuesto: calc.impuestoPorLinea[i]!.toString(),
      fechaDiferimiento: l.fechaDiferimiento || null,
    }));

    // Nota de crédito: no puede superar el saldo disponible de la factura que corrige.
    if (antes.clase === "Nota de Crédito" && input.documentoReferenciaId) {
      const saldo = await saldoNotaCreditoDeFactura(tx, empresaId, input.documentoReferenciaId, {
        excluirDocId: id,
      });
      if (saldo != null && calc.total > saldo + 0.01) {
        throw new Error(
          `La nota de crédito ($${pesos(calc.total)}) supera el saldo disponible de la factura ($${pesos(saldo)}).`,
        );
      }
    }

    await tx.delete(documentosVentaLineas).where(eq(documentosVentaLineas.documentoVentaId, id));
    await tx.insert(documentosVentaLineas).values(lineasCalc);

    const [doc] = await tx
      .update(documentosVenta)
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
        glosa: input.glosa || null,
        documentoReferenciaId: input.documentoReferenciaId ?? null,
        nombreCliente: input.nombreCliente || null,
        condicionPagoDias: input.condicionPagoDias ?? null,
        vendedorId: input.vendedorId ?? null,
        contactoId: input.contactoId ?? null,
        direccionFacturacion: input.direccionFacturacion || null,
        direccionDespacho: input.direccionDespacho || null,
        montoNeto: neto.toString(),
        montoExento: exento.toString(),
        montoImpuesto: totalImp.toString(),
        montoTotal: (neto + exento + totalImp).toString(),
        updatedAt: new Date(),
      })
      .where(and(eq(documentosVenta.id, id), eq(documentosVenta.empresaId, empresaId)))
      .returning();
    if (!doc) throw new Error("No se pudo guardar el documento");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_venta",
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

// ── Contabilizar (genera el asiento) ─────────────────────────────────────────

const PERIODO_BLOQUEA_VENTA = "Bloqueado"; // "Bloqueado excepto ventas" sí permite

type FilaAsientoVenta = {
  cuentaId: string;
  centroCostoId: string | null;
  terceroId: string | null;
  glosa: string;
  debe: number;
  haber: number;
};

type AsientoVentaConstruido = {
  doc: typeof documentosVenta.$inferSelect;
  fechaContab: string;
  glosaCabecera: string;
  filas: FilaAsientoVenta[];
  errores: string[];
  totalDebe: number;
  totalHaber: number;
  cuadra: boolean;
};

/**
 * Arma (sin escribir) el asiento de un documento de venta y **acumula** los problemas en
 * `errores` en vez de lanzar. Base común de `generarAsientoVenta` (contabilizar) y de la
 * vista previa. Ingresos consolidados por cuenta + centro de costo; IVA por cuenta;
 * cuenta puente del cliente por el total.
 */
async function construirAsientoVenta(
  tx: Tx,
  empresaId: string,
  docId: string,
): Promise<AsientoVentaConstruido> {
  const errores: string[] = [];
  const [doc] = await tx
    .select()
    .from(documentosVenta)
    .where(and(eq(documentosVenta.id, docId), eq(documentosVenta.empresaId, empresaId)));
  if (!doc) throw new Error("El documento no existe");

  const fechaContab = doc.fechaContabilizacion ?? doc.fechaEmision;

  const periodo = await periodoDe(empresaId, fechaContab);
  if (!periodo) {
    errores.push(
      "No hay un periodo contable para la fecha de contabilización. Genera el ejercicio.",
    );
  } else if (periodo.estado === PERIODO_BLOQUEA_VENTA) {
    errores.push(
      `El periodo ${periodo.anio}-${String(periodo.mes).padStart(2, "0")} está bloqueado.`,
    );
  }

  if (doc.clase === "Nota de Crédito" && doc.documentoReferenciaId) {
    const saldo = await saldoNotaCreditoDeFactura(tx, empresaId, doc.documentoReferenciaId, {
      excluirDocId: docId,
    });
    if (saldo != null && Number(doc.montoTotal) > saldo + 0.01) {
      errores.push(
        `La nota de crédito ($${pesos(Number(doc.montoTotal))}) supera el saldo disponible de la factura ($${pesos(saldo)}).`,
      );
    }
  }

  const lineas = await tx
    .select()
    .from(documentosVentaLineas)
    .where(eq(documentosVentaLineas.documentoVentaId, docId))
    .orderBy(asc(documentosVentaLineas.numeroLinea));
  if (lineas.length === 0) errores.push("El documento no tiene líneas.");

  const [empresa] = await tx
    .select({ monedaFuncionalId: empresas.monedaFuncionalId })
    .from(empresas)
    .where(eq(empresas.id, empresaId));

  const [tercero] = await tx.select().from(terceros).where(eq(terceros.id, doc.terceroId));
  // Cuenta puente: 1) del cliente, 2) de su grupo de socios de negocio, 3) fallback
  // GENERAL de "Determinación de cuentas".
  const grupoTercero = tercero?.grupoId
    ? (await tx.select().from(tercerosGrupos).where(eq(tercerosGrupos.id, tercero.grupoId)))[0]
    : undefined;
  const cuentaPuente =
    tercero?.cuentaContableAsociadaId ??
    grupoTercero?.cuentaContableAsociadaId ??
    (await resolverCuentaGeneral(tx, empresaId, "venta", "cuenta_por_cobrar"));
  if (!cuentaPuente) {
    errores.push(
      "El cliente no tiene cuenta puente, su grupo tampoco, y no hay regla GENERAL de cuenta por cobrar.",
    );
  }

  const idsImp = [...new Set(lineas.map((l) => l.impuestoId).filter((x): x is string => !!x))];
  const cuentaImpuesto = new Map<string, string>();
  if (idsImp.length) {
    const rows = await tx
      .select({ id: impuestos.id, cuenta: impuestos.cuentaContableId, tipo: impuestos.tipo })
      .from(impuestos)
      .where(and(eq(impuestos.empresaId, empresaId), inArray(impuestos.id, idsImp)));
    const rolPorTipo: Record<string, "iva_debito" | "iva_credito"> = {
      "IVA Débito": "iva_debito",
      "IVA Crédito": "iva_credito",
    };
    for (const r of rows) {
      let cuenta = r.cuenta ?? "";
      if (!cuenta && rolPorTipo[r.tipo]) {
        cuenta = (await resolverCuentaGeneral(tx, empresaId, "impuesto", rolPorTipo[r.tipo]!)) ?? "";
      }
      cuentaImpuesto.set(r.id, cuenta);
    }
  }

  const esCredito = doc.clase === "Nota de Crédito";
  const glosaCabecera =
    `${doc.clase} ${doc.folio ?? doc.numeroInterno ?? ""} — ${tercero?.razonSocial ?? ""}`.trim() ||
    doc.clase;
  const filas: FilaAsientoVenta[] = [];

  if (cuentaPuente) {
    filas.push({
      cuentaId: cuentaPuente,
      centroCostoId: null,
      terceroId: tercero?.id ?? null,
      glosa: glosaCabecera,
      debe: esCredito ? 0 : Number(doc.montoTotal),
      haber: esCredito ? Number(doc.montoTotal) : 0,
    });
  }

  // Ingresos consolidados por cuenta + centro de costo.
  const ingresoPorClave = new Map<
    string,
    { cuentaId: string; centroCostoId: string | null; monto: number }
  >();
  for (const l of lineas) {
    const monto = Number(l.montoNeto);
    if (monto === 0) continue;
    const clave = `${l.cuentaIngresoId}::${l.centroCostoId ?? ""}`;
    const acc =
      ingresoPorClave.get(clave) ??
      { cuentaId: l.cuentaIngresoId, centroCostoId: l.centroCostoId, monto: 0 };
    acc.monto += monto;
    ingresoPorClave.set(clave, acc);
  }
  for (const g of ingresoPorClave.values()) {
    filas.push({
      cuentaId: g.cuentaId,
      centroCostoId: g.centroCostoId,
      terceroId: null,
      glosa: glosaCabecera,
      debe: esCredito ? g.monto : 0,
      haber: esCredito ? 0 : g.monto,
    });
  }

  // IVA consolidado por cuenta.
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
      glosa: "IVA Débito Fiscal",
      debe: esCredito ? monto : 0,
      haber: esCredito ? 0 : monto,
    });
  }

  // ── Costo de venta / existencias por líneas de producto de inventario ──
  const idsProd = [...new Set(lineas.map((l) => l.productoId).filter((x): x is string => !!x))];
  if (idsProd.length) {
    const prods = await tx
      .select({
        id: productos.id,
        codigo: productos.codigo,
        esVenta: productos.esVenta,
        esInventario: productos.esInventario,
        grupoId: productos.grupoId,
      })
      .from(productos)
      .where(inArray(productos.id, idsProd));
    const prodPorId = new Map(prods.map((p) => [p.id, p]));
    const gruposIds = [...new Set(prods.map((p) => p.grupoId))];
    const grupos = gruposIds.length
      ? await tx
          .select({
            id: productosGrupos.id,
            gInv: productosGrupos.cuentaInventarioDefaultId,
            gCosto: productosGrupos.cuentaCostoVentaDefaultId,
          })
          .from(productosGrupos)
          .where(inArray(productosGrupos.id, gruposIds))
      : [];
    const grupoPorId = new Map(grupos.map((g) => [g.id, g]));

    // Cantidad total por producto de inventario (para validar disponibilidad).
    const cantPorProd = new Map<string, number>();
    for (const l of lineas) {
      const p = l.productoId ? prodPorId.get(l.productoId) : undefined;
      if (!p) continue;
      if (!p.esVenta) errores.push(`El artículo ${p.codigo} no está habilitado para venta.`);
      if (p.esInventario) {
        cantPorProd.set(l.productoId!, (cantPorProd.get(l.productoId!) ?? 0) + Number(l.cantidad));
      }
    }

    const costoPorClave = new Map<
      string,
      { cuentaCosto: string; cuentaExist: string; monto: number }
    >();
    for (const l of lineas) {
      const p = l.productoId ? prodPorId.get(l.productoId) : undefined;
      if (!p || !p.esInventario || Number(l.cantidad) === 0) continue;
      const g = grupoPorId.get(p.grupoId);
      const cuentaExist =
        g?.gInv ?? (await resolverCuentaGeneral(tx, empresaId, "compra", "inventario"));
      const cuentaCosto =
        g?.gCosto ?? (await resolverCuentaGeneral(tx, empresaId, "venta", "costo_venta"));
      if (!cuentaExist) {
        errores.push(`El artículo ${p.codigo}: falta la cuenta de Existencias (Determinación de cuentas).`);
        continue;
      }
      if (!cuentaCosto) {
        errores.push(`El artículo ${p.codigo}: falta la cuenta de Costo de venta (Determinación de cuentas).`);
        continue;
      }
      const stock = await obtenerStock(tx, empresaId, l.productoId!);
      const necesita = cantPorProd.get(l.productoId!) ?? 0;
      if (!esCredito && necesita > (stock?.cantidad ?? 0) + 0.000001) {
        errores.push(
          `No hay stock suficiente de ${p.codigo} (disponible ${stock?.cantidad ?? 0}, se necesitan ${necesita}).`,
        );
        continue;
      }
      const costoLinea = redondear(Number(l.cantidad) * (stock?.costoPromedio ?? 0), 4);
      if (costoLinea === 0) continue;
      const clave = `${cuentaCosto}::${cuentaExist}`;
      const acc =
        costoPorClave.get(clave) ?? { cuentaCosto, cuentaExist, monto: 0 };
      acc.monto += costoLinea;
      costoPorClave.set(clave, acc);
    }
    for (const c of costoPorClave.values()) {
      // Venta: Debe Costo / Haber Existencias.  NC (devolución): invertido.
      filas.push({
        cuentaId: c.cuentaCosto,
        centroCostoId: null,
        terceroId: null,
        glosa: "Costo de venta",
        debe: esCredito ? 0 : c.monto,
        haber: esCredito ? c.monto : 0,
      });
      filas.push({
        cuentaId: c.cuentaExist,
        centroCostoId: null,
        terceroId: null,
        glosa: "Existencias",
        debe: esCredito ? c.monto : 0,
        haber: esCredito ? 0 : c.monto,
      });
    }
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
      // La cuenta puente del cliente debe ser Activo/Cliente — simétrico a la validación
      // de Pasivo/Proveedor del lado de compras.
      if (f.cuentaId === cuentaPuente && (c.clase !== "Activo" || c.tipoCuenta !== "Cliente")) {
        errores.push(`La cuenta puente del cliente (${etq}) debe ser de tipo Activo/Cliente.`);
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

/** Inserta `asientos_contables` + `asientos_lineas` a partir de un asiento ya construido. */
async function persistirAsientoVenta(
  tx: Tx,
  empresaId: string,
  built: AsientoVentaConstruido,
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
      tipo: "ingreso",
      origen: "venta",
      estado: "contabilizado",
      documentoOrigenId: doc.id,
      documentoOrigenTabla: "documentos_venta",
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

async function generarAsientoVenta(tx: Tx, empresaId: string, docId: string) {
  const [doc] = await tx
    .select({ estado: documentosVenta.estado })
    .from(documentosVenta)
    .where(and(eq(documentosVenta.id, docId), eq(documentosVenta.empresaId, empresaId)));
  if (!doc) throw new Error("El documento no existe");
  if (doc.estado !== "borrador") throw new Error("El documento ya no está en borrador");

  const built = await construirAsientoVenta(tx, empresaId, docId);
  if (built.errores.length) throw new Error(built.errores[0]);
  return persistirAsientoVenta(tx, empresaId, built);
}

/**
 * Vista previa del asiento de un documento en borrador: filas "humanizadas" (código y
 * nombre de cuenta, centro de costo) + errores de validación que impedirían contabilizar.
 * No escribe nada.
 */
export async function vistaPreviaAsientoVenta(empresaId: string, docId: string) {
  return db.transaction(async (tx) => {
    const built = await construirAsientoVenta(tx, empresaId, docId);

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

/** Asiento contable real con sus líneas "humanizadas", para el visor. */
export async function obtenerAsientoVentaContabilizado(asientoId: string, empresaId: string) {
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
      debeFuncional: asientosLineas.montoDebeFuncional,
      haberFuncional: asientosLineas.montoHaberFuncional,
      tipoCambio: asientosLineas.tipoCambioAplicado,
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

export async function contabilizarDocumentoVenta(
  id: string,
  empresaId: string,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const { asiento, correlativo } = await generarAsientoVenta(tx, empresaId, id);
    const [doc] = await tx
      .update(documentosVenta)
      .set({
        estado: "contabilizado",
        asientoId: asiento.id,
        usuarioContabilizacionId: ctx?.usuarioId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(documentosVenta.id, id), eq(documentosVenta.empresaId, empresaId)))
      .returning();
    if (!doc) throw new Error("No se pudo contabilizar el documento");

    // Salida (o entrada, si es NC) de stock por las líneas de producto de inventario.
    const fechaContab = doc.fechaContabilizacion ?? doc.fechaEmision;
    const esCredito = doc.clase === "Nota de Crédito";
    const lineasDoc = await tx
      .select({ productoId: documentosVentaLineas.productoId, cantidad: documentosVentaLineas.cantidad })
      .from(documentosVentaLineas)
      .where(eq(documentosVentaLineas.documentoVentaId, id));
    const idsLinea = [...new Set(lineasDoc.map((l) => l.productoId).filter((x): x is string => !!x))];
    if (idsLinea.length) {
      const invRows = await tx
        .select({ id: productos.id })
        .from(productos)
        .where(and(inArray(productos.id, idsLinea), eq(productos.esInventario, true)));
      const esInv = new Set(invRows.map((r) => r.id));
      for (const l of lineasDoc) {
        if (!l.productoId || !esInv.has(l.productoId) || Number(l.cantidad) === 0) continue;
        if (esCredito) {
          const stock = await obtenerStock(tx, empresaId, l.productoId);
          await aplicarEntradaStock(tx, empresaId, l.productoId, {
            cantidad: Number(l.cantidad),
            costoUnitario: stock?.costoPromedio ?? 0,
            fecha: fechaContab,
            origenTabla: "documentos_venta",
            origenId: id,
            glosa: etiquetaDoc(doc),
          });
        } else {
          await aplicarSalidaStock(tx, empresaId, l.productoId, {
            cantidad: Number(l.cantidad),
            fecha: fechaContab,
            origenTabla: "documentos_venta",
            origenId: id,
            glosa: etiquetaDoc(doc),
          });
        }
      }
      await tx
        .update(stockMovimientos)
        .set({ asientoId: asiento.id })
        .where(
          and(
            eq(stockMovimientos.origenTabla, "documentos_venta"),
            eq(stockMovimientos.origenId, id),
          ),
        );
    }
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_venta",
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

// ── Anular ───────────────────────────────────────────────────────────────────

export async function anularDocumentoVenta(
  id: string,
  empresaId: string,
  motivo: string,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documentosVenta)
      .where(and(eq(documentosVenta.id, id), eq(documentosVenta.empresaId, empresaId)));
    if (!doc) throw new Error("El documento no existe en esta empresa");
    if (doc.estado === "anulado") throw new Error("El documento ya está anulado");
    if (await tienePagosAplicados(tx, empresaId, "venta", id)) {
      throw new Error("El documento tiene pagos aplicados: anula primero el pago.");
    }

    if (doc.estado === "contabilizado" && doc.asientoId) {
      const fechaContab = doc.fechaContabilizacion ?? doc.fechaEmision;
      const periodo = await periodoDe(empresaId, fechaContab);
      if (periodo && periodo.estado === PERIODO_BLOQUEA_VENTA) {
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
          origen: "anulación venta",
          estado: "contabilizado",
          documentoOrigenId: id,
          documentoOrigenTabla: "documentos_venta",
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

      // Revertir los movimientos de stock de este documento.
      const movs = await tx
        .select({ id: stockMovimientos.id, tipo: stockMovimientos.tipo })
        .from(stockMovimientos)
        .where(
          and(
            eq(stockMovimientos.empresaId, empresaId),
            eq(stockMovimientos.origenTabla, "documentos_venta"),
            eq(stockMovimientos.origenId, id),
          ),
        );
      const hoy = new Date().toISOString().slice(0, 10);
      for (const m of movs) {
        if (m.tipo === "salida") await aplicarReversaSalida(tx, empresaId, m.id, hoy);
        else if (m.tipo === "entrada") await aplicarReversaEntrada(tx, empresaId, m.id, hoy);
      }
    }

    const [actualizado] = await tx
      .update(documentosVenta)
      .set({ estado: "anulado", motivoAnulacion: motivo, updatedAt: new Date() })
      .where(and(eq(documentosVenta.id, id), eq(documentosVenta.empresaId, empresaId)))
      .returning();

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { ...ctx, motivo },
        tabla: "documentos_venta",
        registroId: id,
        etiqueta: etiquetaDoc(doc),
        accion: "cambio_estado",
        antes: { estado: doc.estado },
        despues: { estado: "anulado" },
      });
    }
    return actualizado!;
  });
}

// ── Emitir nota de crédito desde una factura ─────────────────────────────────

/**
 * Crea una NC en borrador a partir de una factura contabilizada, copiando cliente,
 * moneda, tipo de cambio y líneas (con sus montos originales). Rechaza si la factura
 * no tiene saldo disponible (`montoTotal − Σ NC contabilizadas`).
 */
export async function crearNotaCreditoDesdeFactura(
  empresaId: string,
  facturaId: string,
  tipoDocumentoId: string,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [factura] = await tx
      .select()
      .from(documentosVenta)
      .where(and(eq(documentosVenta.id, facturaId), eq(documentosVenta.empresaId, empresaId)));
    if (!factura) throw new Error("La factura no existe en esta empresa");
    if (factura.clase !== "Factura") {
      throw new Error("Solo se puede emitir una nota de crédito desde una factura");
    }
    if (factura.estado !== "contabilizado") {
      throw new Error("La factura debe estar contabilizada");
    }

    const saldo = await saldoNotaCreditoDeFactura(tx, empresaId, facturaId);
    if (saldo == null || saldo <= 0.01) {
      throw new Error("La factura no tiene saldo disponible para notas de crédito.");
    }

    const [tercero] = await tx
      .select({ condicionPagoDias: terceros.condicionPagoDias })
      .from(terceros)
      .where(eq(terceros.id, factura.terceroId));

    const lineasFactura = await tx
      .select()
      .from(documentosVentaLineas)
      .where(eq(documentosVentaLineas.documentoVentaId, facturaId))
      .orderBy(asc(documentosVentaLineas.numeroLinea));

    const idsImp = [
      ...new Set(lineasFactura.map((l) => l.impuestoId).filter((x): x is string => !!x)),
    ];
    const tasas = new Map<string, number>();
    if (idsImp.length) {
      const rows = await tx
        .select({ id: impuestos.id, tasa: impuestos.tasa })
        .from(impuestos)
        .where(and(eq(impuestos.empresaId, empresaId), inArray(impuestos.id, idsImp)));
      for (const r of rows) tasas.set(r.id, Number(r.tasa));
    }
    const [moneda] = await tx
      .select({ decimales: monedas.decimales })
      .from(monedas)
      .where(eq(monedas.id, factura.monedaId));

    const calc = calcularTotalesVenta(
      lineasFactura.map((l) => ({
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        descuentoLineaPct: Number(l.descuentoLineaPct),
        esExento: l.esExento,
        impuestoId: l.impuestoId,
      })),
      tasas,
      moneda?.decimales ?? 0,
      Number(factura.descuentoGlobalPct),
    );

    const numeroInterno = await siguienteCodigo(tx, empresaId, "venta", "documento");
    const hoy = new Date().toISOString().slice(0, 10);
    const [doc] = await tx
      .insert(documentosVenta)
      .values({
        empresaId,
        numeroInterno,
        clase: "Nota de Crédito",
        tipoDocumentoId,
        terceroId: factura.terceroId,
        fechaEmision: hoy,
        fechaContabilizacion: hoy,
        fechaVencimiento: sumarDiasISO(hoy, tercero?.condicionPagoDias ?? 0),
        monedaId: factura.monedaId,
        tipoCambio: factura.tipoCambio,
        descuentoGlobalPct: factura.descuentoGlobalPct,
        glosa: `NC s/ ${etiquetaDoc(factura)}`,
        documentoReferenciaId: facturaId,
        nombreCliente: factura.nombreCliente,
        condicionPagoDias: factura.condicionPagoDias,
        vendedorId: factura.vendedorId,
        contactoId: factura.contactoId,
        direccionFacturacion: factura.direccionFacturacion,
        direccionDespacho: factura.direccionDespacho,
        usuarioCreacionId: ctx?.usuarioId ?? null,
        montoNeto: calc.neto.toString(),
        montoExento: calc.exento.toString(),
        montoImpuesto: calc.totalImp.toString(),
        montoTotal: calc.total.toString(),
      })
      .returning();
    if (!doc) throw new Error("No se pudo crear la nota de crédito");

    if (lineasFactura.length) {
      await tx.insert(documentosVentaLineas).values(
        lineasFactura.map((l, i) => ({
          documentoVentaId: doc.id,
          numeroLinea: i,
          glosa: l.glosa,
          productoId: l.productoId,
          cuentaIngresoId: l.cuentaIngresoId,
          categoriaContableId: l.categoriaContableId,
          centroCostoId: l.centroCostoId,
          impuestoId: l.impuestoId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuentoLineaPct: l.descuentoLineaPct,
          montoNeto: calc.netoPorLinea[i]!.toString(),
          esExento: l.esExento,
          montoImpuesto: calc.impuestoPorLinea[i]!.toString(),
          fechaDiferimiento: l.fechaDiferimiento,
        })),
      );
    }

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_venta",
        registroId: doc.id,
        etiqueta: etiquetaDoc(doc),
        accion: "crear",
        despues: doc,
      });
    }
    return doc;
  });
}

/** Igual que en compras: vencimiento y contabilización son lo único editable de una factura contabilizada. */
export async function actualizarFechasDocumentoVenta(
  id: string,
  empresaId: string,
  input: { fechaVencimiento: string; fechaContabilizacion: string },
  ctx?: AuditoriaCtx,
) {
  const [antes] = await db
    .select()
    .from(documentosVenta)
    .where(and(eq(documentosVenta.id, id), eq(documentosVenta.empresaId, empresaId)));
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
      if (per.estado === PERIODO_BLOQUEA_VENTA) {
        throw new Error(
          `El período ${per.anio}-${String(per.mes).padStart(2, "0")} (fecha ${cual}) está bloqueado para ventas.`,
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
      .update(documentosVenta)
      .set({
        fechaVencimiento: input.fechaVencimiento,
        fechaContabilizacion: input.fechaContabilizacion,
        updatedAt: new Date(),
      })
      .where(and(eq(documentosVenta.id, id), eq(documentosVenta.empresaId, empresaId)))
      .returning();
    if (!doc) throw new Error("No se pudo actualizar el documento");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "documentos_venta",
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
