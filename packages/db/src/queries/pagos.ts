import type { RegistrarPagoInput } from "@erp/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import {
  asientosContables,
  asientosLineas,
  bancos,
  cuentasBancarias,
  documentosCompra,
  documentosVenta,
  empresas,
  metodosPago,
  pagos,
  pagosDocumentos,
  pagosMedios,
  planCuentas,
  terceros,
  tercerosGrupos,
} from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { siguienteCorrelativoAsiento } from "./asientos";
import { obtenerAsientoCompraContabilizado } from "./documentos-compra";
import { periodoDe } from "./periodos";
import { saldosDocumentos } from "./pagos-saldos";
import { resolverCuentaGeneral } from "./reglas-determinacion-cuenta";
import { sembrarSeriesPago, siguienteCodigo } from "./series";

const redondear = (n: number) => Math.round(n * 100) / 100;
const TOLERANCIA = 0.01;

/** Mismas reglas que los documentos: compras se bloquea con "Bloqueado excepto ventas"; ventas no. */
function periodoBloqueado(tipo: "Recibido" | "Efectuado", estado: string): boolean {
  return tipo === "Efectuado"
    ? estado === "Bloqueado" || estado === "Bloqueado excepto ventas"
    : estado === "Bloqueado";
}

async function validarPeriodo(empresaId: string, tipo: "Recibido" | "Efectuado", fecha: string) {
  const per = await periodoDe(empresaId, fecha);
  if (!per) {
    throw new Error("No hay un período contable para la fecha de contabilización. Genera el ejercicio.");
  }
  if (periodoBloqueado(tipo, per.estado)) {
    throw new Error(`El período ${per.anio}-${String(per.mes).padStart(2, "0")} está bloqueado para este pago.`);
  }
}

const TIPO_DOC_PAGABLE_VENTA = new Set(["Factura", "Nota de Débito"]);
const TIPO_DOC_PAGABLE_COMPRA = new Set(["factura", "nota_debito"]);

// ── Documentos abiertos de un tercero ───────────────────────────────────────

export type DocumentoAbierto = {
  id: string;
  numeroInterno: string | null;
  folio: string | null;
  tipo: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  total: number;
  saldo: number;
};

/** Facturas y notas de débito contabilizadas con saldo pendiente (ventas para cobros, compras para pagos). */
export async function listarDocumentosAbiertos(
  empresaId: string,
  tipo: "Recibido" | "Efectuado",
  terceroId: string,
): Promise<DocumentoAbierto[]> {
  if (tipo === "Recibido") {
    const docs = await db
      .select()
      .from(documentosVenta)
      .where(
        and(
          eq(documentosVenta.empresaId, empresaId),
          eq(documentosVenta.terceroId, terceroId),
          eq(documentosVenta.estado, "contabilizado"),
        ),
      )
      .orderBy(asc(documentosVenta.fechaVencimiento), asc(documentosVenta.fechaEmision));
    const pagables = docs.filter((d) => TIPO_DOC_PAGABLE_VENTA.has(d.clase));
    const saldos = await saldosDocumentos(db, empresaId, "venta", pagables.map((d) => d.id));
    return pagables
      .map((d) => ({
        id: d.id,
        numeroInterno: d.numeroInterno,
        folio: d.folio,
        tipo: d.clase,
        fechaEmision: d.fechaEmision,
        fechaVencimiento: d.fechaVencimiento,
        total: Number(d.montoTotal),
        saldo: saldos.get(d.id)?.saldo ?? 0,
      }))
      .filter((d) => d.saldo > TOLERANCIA);
  }
  const docs = await db
    .select()
    .from(documentosCompra)
    .where(
      and(
        eq(documentosCompra.empresaId, empresaId),
        eq(documentosCompra.terceroId, terceroId),
        eq(documentosCompra.estado, "contabilizado"),
      ),
    )
    .orderBy(asc(documentosCompra.fechaVencimiento), asc(documentosCompra.fechaEmision));
  const pagables = docs.filter((d) => TIPO_DOC_PAGABLE_COMPRA.has(d.docTipo));
  const saldos = await saldosDocumentos(db, empresaId, "compra", pagables.map((d) => d.id));
  return pagables
    .map((d) => ({
      id: d.id,
      numeroInterno: d.numeroInterno,
      folio: d.folio,
      tipo: d.docTipo === "nota_debito" ? "Nota de Débito" : "Factura",
      fechaEmision: d.fechaEmision,
      fechaVencimiento: d.fechaVencimiento,
      total: Number(d.montoTotal),
      saldo: saldos.get(d.id)?.saldo ?? 0,
    }))
    .filter((d) => d.saldo > TOLERANCIA);
}

// ── Registrar (contabiliza al guardar) ──────────────────────────────────────

export async function registrarPago(empresaId: string, input: RegistrarPagoInput, ctx?: AuditoriaCtx) {
  await validarPeriodo(empresaId, input.tipo, input.fechaContabilizacion);
  const esRecibido = input.tipo === "Recibido";
  const tablaDoc = esRecibido ? "venta" : "compra";

  return db.transaction(async (tx) => {
    const [empresa] = await tx
      .select({ monedaFuncionalId: empresas.monedaFuncionalId })
      .from(empresas)
      .where(eq(empresas.id, empresaId));
    if (!empresa) throw new Error("La empresa no existe");

    const [tercero] = await tx
      .select()
      .from(terceros)
      .where(and(eq(terceros.id, input.terceroId), eq(terceros.empresaId, empresaId)));
    if (!tercero) throw new Error("El tercero no existe en esta empresa");

    // ── Medios de pago → cuenta contable efectiva de cada uno ──
    const metodoIds = [...new Set(input.medios.map((m) => m.metodoPagoId))];
    const metodos = await tx
      .select()
      .from(metodosPago)
      .where(and(eq(metodosPago.empresaId, empresaId), inArray(metodosPago.id, metodoIds)));
    const metodoPorId = new Map(metodos.map((m) => [m.id, m]));
    const cbIds = metodos.map((m) => m.cuentaBancariaId).filter((x): x is string => !!x);
    const cbs = cbIds.length
      ? await tx
          .select()
          .from(cuentasBancarias)
          .where(and(eq(cuentasBancarias.empresaId, empresaId), inArray(cuentasBancarias.id, cbIds)))
      : [];
    const cbPorId = new Map(cbs.map((c) => [c.id, c]));

    const mediosResueltos = input.medios.map((m, i) => {
      const metodo = metodoPorId.get(m.metodoPagoId);
      if (!metodo) throw new Error(`Medio de pago ${i + 1}: el método no existe en esta empresa`);
      if (!metodo.activo) throw new Error(`El método de pago "${metodo.nombre}" está inactivo`);
      if (metodo.sentido !== "Ambos" && metodo.sentido !== input.tipo) {
        throw new Error(`El método "${metodo.nombre}" no sirve para pagos ${input.tipo === "Recibido" ? "recibidos" : "efectuados"}`);
      }
      const cb = metodo.cuentaBancariaId ? cbPorId.get(metodo.cuentaBancariaId) : undefined;
      if (metodo.cuentaBancariaId && (!cb || !cb.activa)) {
        throw new Error(`El método "${metodo.nombre}" usa una cuenta bancaria inactiva`);
      }
      const cuentaId = metodo.cuentaContableId ?? cb?.cuentaContableId;
      if (!cuentaId) throw new Error(`El método "${metodo.nombre}" no tiene cuenta contable asociada`);
      if (metodo.tipo === "Cheque" && !m.chequeNumero?.trim()) {
        throw new Error(`Medio de pago ${i + 1}: indica el número del cheque`);
      }
      return { ...m, metodo, cuentaId };
    });
    const cuentasMedios = await tx
      .select({ id: planCuentas.id, activa: planCuentas.activa, imp: planCuentas.nivelImputable, codigo: planCuentas.codigoCuenta })
      .from(planCuentas)
      .where(
        and(
          eq(planCuentas.empresaId, empresaId),
          inArray(planCuentas.id, [...new Set(mediosResueltos.map((m) => m.cuentaId))]),
        ),
      );
    for (const c of cuentasMedios) {
      if (!c.activa || !c.imp) throw new Error(`La cuenta ${c.codigo} de un medio de pago no está disponible`);
    }

    // ── Documentos a los que se aplica (bloqueados para evitar pagos simultáneos) ──
    const docIds = input.aplicaciones.map((a) => a.documentoId);
    if (docIds.length) {
      const docs =
        tablaDoc === "venta"
          ? await tx
              .select({
                id: documentosVenta.id,
                terceroId: documentosVenta.terceroId,
                estado: documentosVenta.estado,
                monedaId: documentosVenta.monedaId,
                tipo: documentosVenta.clase,
                numero: documentosVenta.numeroInterno,
              })
              .from(documentosVenta)
              .where(and(eq(documentosVenta.empresaId, empresaId), inArray(documentosVenta.id, docIds)))
              .for("update")
          : await tx
              .select({
                id: documentosCompra.id,
                terceroId: documentosCompra.terceroId,
                estado: documentosCompra.estado,
                monedaId: documentosCompra.monedaId,
                tipo: documentosCompra.docTipo,
                numero: documentosCompra.numeroInterno,
              })
              .from(documentosCompra)
              .where(and(eq(documentosCompra.empresaId, empresaId), inArray(documentosCompra.id, docIds)))
              .for("update");
      const docPorId = new Map(docs.map((d) => [d.id, d]));
      const saldos = await saldosDocumentos(tx, empresaId, tablaDoc, docIds);
      for (const a of input.aplicaciones) {
        const d = docPorId.get(a.documentoId);
        if (!d) throw new Error("Un documento a pagar no existe en esta empresa");
        const etiqueta = d.numero ?? d.id;
        if (d.terceroId !== input.terceroId) throw new Error(`El documento ${etiqueta} es de otro tercero`);
        if (d.estado !== "contabilizado") throw new Error(`El documento ${etiqueta} no está contabilizado`);
        const pagable = esRecibido ? TIPO_DOC_PAGABLE_VENTA.has(d.tipo) : TIPO_DOC_PAGABLE_COMPRA.has(d.tipo);
        if (!pagable) throw new Error(`El documento ${etiqueta} no admite pagos (solo facturas y notas de débito)`);
        if (d.monedaId !== empresa.monedaFuncionalId) {
          throw new Error(`El documento ${etiqueta} está en moneda extranjera: los pagos en moneda extranjera aún no están habilitados`);
        }
        const saldo = saldos.get(a.documentoId)?.saldo ?? 0;
        if (a.monto > saldo + TOLERANCIA) {
          throw new Error(`El monto aplicado al documento ${etiqueta} (${a.monto}) supera su saldo (${saldo})`);
        }
      }
    }

    // ── Cuenta del tercero (cliente/proveedor): tercero → grupo → regla general ──
    const grupo = tercero.grupoId
      ? (await tx.select().from(tercerosGrupos).where(eq(tercerosGrupos.id, tercero.grupoId)))[0]
      : undefined;
    const cuentaTercero =
      tercero.cuentaContableAsociadaId ??
      grupo?.cuentaContableAsociadaId ??
      (await resolverCuentaGeneral(tx, empresaId, esRecibido ? "venta" : "compra", esRecibido ? "cuenta_por_cobrar" : "cuenta_por_pagar"));
    if (!cuentaTercero) {
      throw new Error(
        `El ${esRecibido ? "cliente" : "proveedor"} no tiene cuenta contable, su grupo tampoco, y no hay regla general de cuenta por ${esRecibido ? "cobrar" : "pagar"}.`,
      );
    }
    const [ctaTercero] = await tx
      .select({ clase: planCuentas.clase, tipo: planCuentas.tipoCuenta, codigo: planCuentas.codigoCuenta })
      .from(planCuentas)
      .where(and(eq(planCuentas.id, cuentaTercero), eq(planCuentas.empresaId, empresaId)));
    if (!ctaTercero) throw new Error("La cuenta contable del tercero no pertenece a esta empresa");
    const tipoEsperado = esRecibido ? "Cliente" : "Proveedor";
    if (ctaTercero.tipo !== tipoEsperado) {
      throw new Error(`La cuenta ${ctaTercero.codigo} del tercero debe ser de tipo ${tipoEsperado}`);
    }

    // ── Encabezado, medios y aplicaciones ──
    const totalMedios = redondear(mediosResueltos.reduce((a, m) => a + m.monto, 0));
    const totalAplicado = redondear(input.aplicaciones.reduce((a, m) => a + m.monto, 0));
    await sembrarSeriesPago(tx, empresaId);
    const numeroInterno = await siguienteCodigo(tx, empresaId, "pago", esRecibido ? "recibido" : "efectuado");

    const [pago] = await tx
      .insert(pagos)
      .values({
        empresaId,
        tipo: input.tipo,
        numeroInterno,
        terceroId: input.terceroId,
        fechaPago: input.fechaPago,
        fechaContabilizacion: input.fechaContabilizacion,
        monedaId: empresa.monedaFuncionalId,
        tipoCambio: "1",
        montoTotal: totalMedios.toString(),
        montoAplicado: totalAplicado.toString(),
        glosa: input.glosa || null,
        referencia: input.referencia || null,
        estado: "contabilizado",
        usuarioId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!pago) throw new Error("No se pudo registrar el pago");

    await tx.insert(pagosMedios).values(
      mediosResueltos.map((m, i) => ({
        pagoId: pago.id,
        numeroLinea: i,
        metodoPagoId: m.metodoPagoId,
        tipo: m.metodo.tipo,
        cuentaId: m.cuentaId,
        monto: m.monto.toString(),
        referencia: m.referencia || null,
        chequeNumero: m.chequeNumero || null,
        chequeBancoId: m.chequeBancoId ?? null,
        fechaCobro: m.fechaCobro ?? null,
      })),
    );
    if (input.aplicaciones.length) {
      await tx.insert(pagosDocumentos).values(
        input.aplicaciones.map((a) => ({
          pagoId: pago.id,
          documentoCompraId: esRecibido ? null : a.documentoId,
          documentoVentaId: esRecibido ? a.documentoId : null,
          montoAplicado: a.monto.toString(),
        })),
      );
    }

    // ── Asiento: Recibido = Dr medios / Cr cliente; Efectuado = Dr proveedor / Cr medios ──
    const glosa = `${esRecibido ? "Pago recibido" : "Pago efectuado"} ${numeroInterno} — ${tercero.razonSocial}`;
    const anio = Number(input.fechaContabilizacion.slice(0, 4));
    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
    const [asiento] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha: input.fechaContabilizacion,
        glosa,
        tipo: esRecibido ? "ingreso" : "egreso",
        origen: esRecibido ? "pago recibido" : "pago efectuado",
        estado: "contabilizado",
        documentoOrigenId: pago.id,
        documentoOrigenTabla: "pagos",
      })
      .returning();
    if (!asiento) throw new Error("No se pudo crear el asiento del pago");

    const linea = (cuentaId: string, debe: number, haber: number, terceroId: string | null, texto: string) => ({
      asientoId: asiento.id,
      cuentaId,
      terceroId,
      glosa: texto,
      montoDebeOrigen: debe.toString(),
      montoHaberOrigen: haber.toString(),
      monedaOrigenId: empresa.monedaFuncionalId,
      tipoCambioAplicado: "1",
      montoDebeFuncional: debe.toString(),
      montoHaberFuncional: haber.toString(),
      documentoReferenciaId: pago.id,
    });
    const lineasMedios = mediosResueltos.map((m) =>
      esRecibido
        ? linea(m.cuentaId, m.monto, 0, null, `${m.metodo.nombre}${m.referencia ? ` ${m.referencia}` : m.chequeNumero ? ` cheque ${m.chequeNumero}` : ""}`)
        : linea(m.cuentaId, 0, m.monto, null, `${m.metodo.nombre}${m.referencia ? ` ${m.referencia}` : m.chequeNumero ? ` cheque ${m.chequeNumero}` : ""}`),
    );
    const lineaTercero = esRecibido
      ? linea(cuentaTercero, 0, totalMedios, tercero.id, glosa)
      : linea(cuentaTercero, totalMedios, 0, tercero.id, glosa);
    await tx.insert(asientosLineas).values(esRecibido ? [...lineasMedios, lineaTercero] : [lineaTercero, ...lineasMedios]);

    const [final] = await tx
      .update(pagos)
      .set({ asientoId: asiento.id, updatedAt: new Date() })
      .where(eq(pagos.id, pago.id))
      .returning();
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "pagos",
        registroId: pago.id,
        etiqueta: numeroInterno,
        accion: "crear",
        despues: { ...final, asiento: correlativo },
      });
    }
    return { pago: final!, correlativoAsiento: correlativo };
  });
}

// ── Anular ──────────────────────────────────────────────────────────────────

export async function anularPago(pagoId: string, empresaId: string, motivo: string, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const [pago] = await tx
      .select()
      .from(pagos)
      .where(and(eq(pagos.id, pagoId), eq(pagos.empresaId, empresaId)))
      .for("update");
    if (!pago) throw new Error("El pago no existe en esta empresa");
    if (pago.estado === "anulado") throw new Error("El pago ya está anulado");
    if (!pago.asientoId) throw new Error("El pago no tiene asiento que revertir");

    const per = await periodoDe(empresaId, pago.fechaContabilizacion);
    if (per && periodoBloqueado(pago.tipo, per.estado)) {
      throw new Error("El período del pago está bloqueado; reábrelo para anularlo.");
    }

    const original = await tx.select().from(asientosLineas).where(eq(asientosLineas.asientoId, pago.asientoId));
    const [cab] = await tx.select().from(asientosContables).where(eq(asientosContables.id, pago.asientoId));
    const anio = Number(pago.fechaContabilizacion.slice(0, 4));
    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
    const [reversa] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha: pago.fechaContabilizacion,
        glosa: `Reversa: ${cab?.glosa ?? pago.numeroInterno}`,
        tipo: "ajuste",
        origen: "anulación pago",
        estado: "contabilizado",
        documentoOrigenId: pago.id,
        documentoOrigenTabla: "pagos",
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
        documentoReferenciaId: pago.id,
      })),
    );
    const [act] = await tx
      .update(pagos)
      .set({ estado: "anulado", motivoAnulacion: motivo, asientoReversaId: reversa.id, updatedAt: new Date() })
      .where(eq(pagos.id, pagoId))
      .returning();
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { ...ctx, motivo },
        tabla: "pagos",
        registroId: pago.id,
        etiqueta: pago.numeroInterno,
        accion: "cambio_estado",
        antes: { estado: pago.estado },
        despues: { estado: "anulado", reversa: correlativo },
      });
    }
    return act!;
  });
}

// ── Lecturas ────────────────────────────────────────────────────────────────

export async function listarPagos(empresaId: string, tipo: "Recibido" | "Efectuado") {
  const rows = await db
    .select({
      id: pagos.id,
      numeroInterno: pagos.numeroInterno,
      fechaPago: pagos.fechaPago,
      fechaContabilizacion: pagos.fechaContabilizacion,
      terceroId: pagos.terceroId,
      tercero: terceros.razonSocial,
      montoTotal: pagos.montoTotal,
      montoAplicado: pagos.montoAplicado,
      estado: pagos.estado,
      referencia: pagos.referencia,
    })
    .from(pagos)
    .innerJoin(terceros, eq(terceros.id, pagos.terceroId))
    .where(and(eq(pagos.empresaId, empresaId), eq(pagos.tipo, tipo)))
    .orderBy(desc(pagos.fechaPago), desc(pagos.numeroInterno));
  if (rows.length === 0) return [];
  const medios = await db
    .select({ pagoId: pagosMedios.pagoId, nombre: metodosPago.nombre })
    .from(pagosMedios)
    .innerJoin(metodosPago, eq(metodosPago.id, pagosMedios.metodoPagoId))
    .where(inArray(pagosMedios.pagoId, rows.map((r) => r.id)));
  const mediosPorPago = new Map<string, string[]>();
  for (const m of medios) mediosPorPago.set(m.pagoId, [...(mediosPorPago.get(m.pagoId) ?? []), m.nombre]);
  return rows.map((r) => ({ ...r, medios: [...new Set(mediosPorPago.get(r.id) ?? [])].join(", ") }));
}

export async function obtenerPagoConDetalle(pagoId: string, empresaId: string) {
  const [pago] = await db
    .select()
    .from(pagos)
    .where(and(eq(pagos.id, pagoId), eq(pagos.empresaId, empresaId)));
  if (!pago) return null;
  const [tercero] = await db.select().from(terceros).where(eq(terceros.id, pago.terceroId));
  const medios = await db
    .select({
      id: pagosMedios.id,
      metodo: metodosPago.nombre,
      tipo: pagosMedios.tipo,
      monto: pagosMedios.monto,
      referencia: pagosMedios.referencia,
      chequeNumero: pagosMedios.chequeNumero,
      chequeBanco: bancos.nombre,
      fechaCobro: pagosMedios.fechaCobro,
      cuentaCodigo: planCuentas.codigoCuenta,
      cuentaNombre: planCuentas.nombreCuenta,
    })
    .from(pagosMedios)
    .innerJoin(metodosPago, eq(metodosPago.id, pagosMedios.metodoPagoId))
    .innerJoin(planCuentas, eq(planCuentas.id, pagosMedios.cuentaId))
    .leftJoin(bancos, eq(bancos.id, pagosMedios.chequeBancoId))
    .where(eq(pagosMedios.pagoId, pagoId))
    .orderBy(asc(pagosMedios.numeroLinea));
  const apl = await db.select().from(pagosDocumentos).where(eq(pagosDocumentos.pagoId, pagoId));
  const idsVenta = apl.map((a) => a.documentoVentaId).filter((x): x is string => !!x);
  const idsCompra = apl.map((a) => a.documentoCompraId).filter((x): x is string => !!x);
  const ventas = idsVenta.length
    ? await db.select().from(documentosVenta).where(inArray(documentosVenta.id, idsVenta))
    : [];
  const compras = idsCompra.length
    ? await db.select().from(documentosCompra).where(inArray(documentosCompra.id, idsCompra))
    : [];
  const aplicaciones = apl.map((a) => {
    const v = ventas.find((d) => d.id === a.documentoVentaId);
    const c = compras.find((d) => d.id === a.documentoCompraId);
    return {
      id: a.id,
      documentoId: (v?.id ?? c?.id) as string,
      origen: v ? ("venta" as const) : ("compra" as const),
      numeroInterno: v?.numeroInterno ?? c?.numeroInterno ?? null,
      folio: v?.folio ?? c?.folio ?? null,
      tipo: v ? v.clase : c?.docTipo === "nota_debito" ? "Nota de Débito" : "Factura",
      fechaEmision: (v?.fechaEmision ?? c?.fechaEmision) as string,
      total: Number(v?.montoTotal ?? c?.montoTotal ?? 0),
      montoAplicado: Number(a.montoAplicado),
    };
  });
  const asiento = pago.asientoId ? await obtenerAsientoCompraContabilizado(pago.asientoId, empresaId) : null;
  const reversa = pago.asientoReversaId
    ? await obtenerAsientoCompraContabilizado(pago.asientoReversaId, empresaId)
    : null;
  return { pago, tercero: tercero ?? null, medios, aplicaciones, asiento, reversa };
}
