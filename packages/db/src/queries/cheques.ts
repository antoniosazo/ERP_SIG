import type { ProtestarChequeInput, RegistrarDepositoInput } from "@erp/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import {
  asientosContables,
  asientosLineas,
  bancos,
  cheques,
  cuentasBancarias,
  depositos,
  depositosCheques,
  empresas,
  pagos,
  pagosDocumentos,
  pagosMedios,
  planCuentas,
  terceros,
} from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { siguienteCorrelativoAsiento } from "./asientos";
import { obtenerAsientoCompraContabilizado } from "./documentos-compra";
import { periodoDe } from "./periodos";
import { sembrarSeriesPago, siguienteCodigo } from "./series";

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Depósitos y protestos son movimientos de cobranza: solo los bloquea un período "Bloqueado". */
async function validarPeriodo(empresaId: string, fecha: string) {
  const per = await periodoDe(empresaId, fecha);
  if (!per) throw new Error("No hay un período contable para esa fecha. Genera el ejercicio.");
  if (per.estado === "Bloqueado") {
    throw new Error(`El período ${per.anio}-${String(per.mes).padStart(2, "0")} está bloqueado.`);
  }
}

// ── Lecturas ────────────────────────────────────────────────────────────────

export async function listarCheques(
  empresaId: string,
  filtro: { tipo?: "Recibido" | "Emitido"; estado?: string } = {},
) {
  const condiciones = [eq(cheques.empresaId, empresaId)];
  if (filtro.tipo) condiciones.push(eq(cheques.tipo, filtro.tipo));
  if (filtro.estado) condiciones.push(eq(cheques.estado, filtro.estado as never));
  return db
    .select({
      id: cheques.id,
      tipo: cheques.tipo,
      numero: cheques.numero,
      terceroId: cheques.terceroId,
      tercero: terceros.razonSocial,
      banco: bancos.nombre,
      monto: cheques.monto,
      fechaEmision: cheques.fechaEmision,
      fechaCobro: cheques.fechaCobro,
      estado: cheques.estado,
      pagoId: cheques.pagoId,
      pagoNumero: pagos.numeroInterno,
      depositoId: cheques.depositoId,
      fechaProtesto: cheques.fechaProtesto,
      motivoProtesto: cheques.motivoProtesto,
    })
    .from(cheques)
    .innerJoin(terceros, eq(terceros.id, cheques.terceroId))
    .innerJoin(pagos, eq(pagos.id, cheques.pagoId))
    .leftJoin(bancos, eq(bancos.id, cheques.bancoId))
    .where(and(...condiciones))
    .orderBy(asc(cheques.fechaCobro), desc(cheques.fechaEmision), asc(cheques.numero));
}

export async function listarDepositos(empresaId: string) {
  return db
    .select({
      id: depositos.id,
      numeroInterno: depositos.numeroInterno,
      fecha: depositos.fecha,
      montoTotal: depositos.montoTotal,
      estado: depositos.estado,
      glosa: depositos.glosa,
      banco: bancos.nombre,
      cuentaNumero: cuentasBancarias.numeroCuenta,
      cuentaAlias: cuentasBancarias.alias,
    })
    .from(depositos)
    .innerJoin(cuentasBancarias, eq(cuentasBancarias.id, depositos.cuentaBancariaId))
    .innerJoin(bancos, eq(bancos.id, cuentasBancarias.bancoId))
    .where(eq(depositos.empresaId, empresaId))
    .orderBy(desc(depositos.fecha), desc(depositos.numeroInterno));
}

export async function obtenerDepositoConDetalle(depositoId: string, empresaId: string) {
  const [deposito] = await db
    .select()
    .from(depositos)
    .where(and(eq(depositos.id, depositoId), eq(depositos.empresaId, empresaId)));
  if (!deposito) return null;
  const [cuenta] = await db
    .select({
      id: cuentasBancarias.id,
      banco: bancos.nombre,
      numeroCuenta: cuentasBancarias.numeroCuenta,
      alias: cuentasBancarias.alias,
    })
    .from(cuentasBancarias)
    .innerJoin(bancos, eq(bancos.id, cuentasBancarias.bancoId))
    .where(eq(cuentasBancarias.id, deposito.cuentaBancariaId));
  const items = await db
    .select({
      id: cheques.id,
      numero: cheques.numero,
      tercero: terceros.razonSocial,
      banco: bancos.nombre,
      monto: depositosCheques.monto,
      fechaCobro: cheques.fechaCobro,
      estado: cheques.estado,
    })
    .from(depositosCheques)
    .innerJoin(cheques, eq(cheques.id, depositosCheques.chequeId))
    .innerJoin(terceros, eq(terceros.id, cheques.terceroId))
    .leftJoin(bancos, eq(bancos.id, cheques.bancoId))
    .where(eq(depositosCheques.depositoId, depositoId));
  const asiento = deposito.asientoId ? await obtenerAsientoCompraContabilizado(deposito.asientoId, empresaId) : null;
  const reversa = deposito.asientoReversaId
    ? await obtenerAsientoCompraContabilizado(deposito.asientoReversaId, empresaId)
    : null;
  return { deposito, cuenta: cuenta ?? null, cheques: items, asiento, reversa };
}

// ── Depósito ────────────────────────────────────────────────────────────────

export async function registrarDeposito(empresaId: string, input: RegistrarDepositoInput, ctx?: AuditoriaCtx) {
  await validarPeriodo(empresaId, input.fechaContabilizacion);
  return db.transaction(async (tx) => {
    const [empresa] = await tx
      .select({ monedaFuncionalId: empresas.monedaFuncionalId })
      .from(empresas)
      .where(eq(empresas.id, empresaId));
    const [cb] = await tx
      .select()
      .from(cuentasBancarias)
      .where(and(eq(cuentasBancarias.id, input.cuentaBancariaId), eq(cuentasBancarias.empresaId, empresaId)));
    if (!cb) throw new Error("La cuenta bancaria no pertenece a esta empresa");
    if (!cb.activa) throw new Error("La cuenta bancaria está inactiva");
    if (cb.monedaId !== empresa?.monedaFuncionalId) {
      throw new Error("Los depósitos en cuentas de moneda extranjera aún no están habilitados");
    }

    const ids = [...new Set(input.chequeIds)];
    const selec = await tx
      .select({
        id: cheques.id,
        tipo: cheques.tipo,
        estado: cheques.estado,
        numero: cheques.numero,
        monto: cheques.monto,
        fechaCobro: cheques.fechaCobro,
        cuentaCartera: pagosMedios.cuentaId,
      })
      .from(cheques)
      .innerJoin(pagosMedios, eq(pagosMedios.id, cheques.pagoMedioId))
      .where(and(eq(cheques.empresaId, empresaId), inArray(cheques.id, ids)))
      .for("update", { of: cheques });
    if (selec.length !== ids.length) throw new Error("Algún cheque no existe en esta empresa");
    for (const c of selec) {
      if (c.tipo !== "Recibido") throw new Error(`El cheque N° ${c.numero} es emitido: solo se depositan cheques recibidos`);
      if (c.estado !== "en_cartera") throw new Error(`El cheque N° ${c.numero} no está en cartera (${c.estado})`);
      if (c.fechaCobro && c.fechaCobro > input.fecha) {
        throw new Error(`El cheque N° ${c.numero} es a fecha: se puede depositar desde el ${c.fechaCobro}`);
      }
    }

    const total = redondear(selec.reduce((a, c) => a + Number(c.monto), 0));
    await sembrarSeriesPago(tx, empresaId);
    const numeroInterno = await siguienteCodigo(tx, empresaId, "pago", "deposito");
    const [dep] = await tx
      .insert(depositos)
      .values({
        empresaId,
        numeroInterno,
        fecha: input.fecha,
        fechaContabilizacion: input.fechaContabilizacion,
        cuentaBancariaId: cb.id,
        montoTotal: total.toString(),
        glosa: input.glosa || null,
        estado: "contabilizado",
        usuarioId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!dep) throw new Error("No se pudo registrar el depósito");
    await tx.insert(depositosCheques).values(selec.map((c) => ({ depositoId: dep.id, chequeId: c.id, monto: c.monto })));

    // Asiento: Dr banco / Cr cuenta de cartera de cada cheque (agrupado por cuenta).
    const glosa = `Depósito de cheques ${numeroInterno} (${selec.length})`;
    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, Number(input.fechaContabilizacion.slice(0, 4)));
    const [asiento] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha: input.fechaContabilizacion,
        glosa,
        tipo: "traspaso",
        origen: "depósito de cheques",
        estado: "contabilizado",
        documentoOrigenId: dep.id,
        documentoOrigenTabla: "depositos",
      })
      .returning();
    if (!asiento) throw new Error("No se pudo crear el asiento del depósito");
    const porCuenta = new Map<string, number>();
    for (const c of selec) porCuenta.set(c.cuentaCartera, (porCuenta.get(c.cuentaCartera) ?? 0) + Number(c.monto));
    const linea = (cuentaId: string, debe: number, haber: number, texto: string) => ({
      asientoId: asiento.id,
      cuentaId,
      terceroId: null,
      glosa: texto,
      montoDebeOrigen: debe.toString(),
      montoHaberOrigen: haber.toString(),
      monedaOrigenId: empresa!.monedaFuncionalId,
      tipoCambioAplicado: "1",
      montoDebeFuncional: debe.toString(),
      montoHaberFuncional: haber.toString(),
      documentoReferenciaId: dep.id,
    });
    await tx.insert(asientosLineas).values([
      linea(cb.cuentaContableId, total, 0, glosa),
      ...[...porCuenta.entries()].map(([cuentaId, monto]) => linea(cuentaId, 0, redondear(monto), "Cheques en cartera")),
    ]);

    await tx
      .update(cheques)
      .set({ estado: "depositado", depositoId: dep.id, updatedAt: new Date() })
      .where(inArray(cheques.id, ids));
    const [final] = await tx.update(depositos).set({ asientoId: asiento.id }).where(eq(depositos.id, dep.id)).returning();
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "depositos",
        registroId: dep.id,
        etiqueta: `Depósito ${numeroInterno}`,
        accion: "crear",
        despues: {
          ...final,
          asientoCorrelativo: correlativo,
          cuentaBancaria: cb.numeroCuenta,
          cheques: selec.map((c) => ({ numero: c.numero, monto: Number(c.monto) })),
        },
      });
      for (const c of selec) {
        await registrarAuditoria(tx, {
          empresaId,
          ctx,
          tabla: "cheques",
          registroId: c.id,
          etiqueta: `Cheque N° ${c.numero}`,
          accion: "cambio_estado",
          antes: { estado: "en_cartera" },
          despues: { estado: "depositado", deposito: numeroInterno },
        });
      }
    }
    return { deposito: final!, correlativoAsiento: correlativo };
  });
}

export async function anularDeposito(depositoId: string, empresaId: string, motivo: string, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const [dep] = await tx
      .select()
      .from(depositos)
      .where(and(eq(depositos.id, depositoId), eq(depositos.empresaId, empresaId)))
      .for("update");
    if (!dep) throw new Error("El depósito no existe en esta empresa");
    if (dep.estado === "anulado") throw new Error("El depósito ya está anulado");
    if (!dep.asientoId) throw new Error("El depósito no tiene asiento que revertir");
    await validarPeriodo(empresaId, dep.fechaContabilizacion);

    const items = await tx.select().from(cheques).where(eq(cheques.depositoId, depositoId));
    const protestado = items.find((c) => c.estado !== "depositado");
    if (protestado) {
      throw new Error(`El cheque N° ${protestado.numero} está ${protestado.estado}: no se puede anular el depósito.`);
    }

    const original = await tx.select().from(asientosLineas).where(eq(asientosLineas.asientoId, dep.asientoId));
    const [cab] = await tx.select().from(asientosContables).where(eq(asientosContables.id, dep.asientoId));
    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, Number(dep.fechaContabilizacion.slice(0, 4)));
    const [reversa] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha: dep.fechaContabilizacion,
        glosa: `Reversa: ${cab?.glosa ?? dep.numeroInterno}`,
        tipo: "ajuste",
        origen: "anulación depósito",
        estado: "contabilizado",
        documentoOrigenId: dep.id,
        documentoOrigenTabla: "depositos",
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
        documentoReferenciaId: dep.id,
      })),
    );
    // Los cheques vuelven a cartera.
    await tx
      .update(cheques)
      .set({ estado: "en_cartera", depositoId: null, updatedAt: new Date() })
      .where(eq(cheques.depositoId, depositoId));
    const [act] = await tx
      .update(depositos)
      .set({ estado: "anulado", motivoAnulacion: motivo, asientoReversaId: reversa.id, updatedAt: new Date() })
      .where(eq(depositos.id, depositoId))
      .returning();
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { ...ctx, motivo },
        tabla: "depositos",
        registroId: dep.id,
        etiqueta: `Depósito ${dep.numeroInterno}`,
        accion: "cambio_estado",
        antes: { estado: dep.estado },
        despues: { estado: "anulado", reversa: correlativo },
      });
      for (const c of items) {
        await registrarAuditoria(tx, {
          empresaId,
          ctx: { ...ctx, motivo },
          tabla: "cheques",
          registroId: c.id,
          etiqueta: `Cheque N° ${c.numero}`,
          accion: "cambio_estado",
          antes: { estado: "depositado", deposito: dep.numeroInterno },
          despues: { estado: "en_cartera", motivo: `Anulación del depósito ${dep.numeroInterno}` },
        });
      }
    }
    return act!;
  });
}

// ── Protesto: el banco devuelve el cheque y la deuda del cliente se reabre ──

export async function protestarCheque(
  chequeId: string,
  empresaId: string,
  input: ProtestarChequeInput,
  ctx?: AuditoriaCtx,
) {
  await validarPeriodo(empresaId, input.fecha);
  return db.transaction(async (tx) => {
    const [cheque] = await tx
      .select()
      .from(cheques)
      .where(and(eq(cheques.id, chequeId), eq(cheques.empresaId, empresaId)))
      .for("update");
    if (!cheque) throw new Error("El cheque no existe en esta empresa");
    if (cheque.tipo !== "Recibido") throw new Error("Solo se protestan cheques recibidos");
    if (cheque.estado !== "depositado" || !cheque.depositoId) {
      throw new Error("Solo se puede protestar un cheque depositado");
    }
    const [dep] = await tx.select().from(depositos).where(eq(depositos.id, cheque.depositoId));
    if (!dep || dep.estado !== "contabilizado") throw new Error("El depósito del cheque no está vigente");
    if (input.fecha < dep.fecha) throw new Error("La fecha del protesto no puede ser anterior al depósito");
    const [cb] = await tx.select().from(cuentasBancarias).where(eq(cuentasBancarias.id, dep.cuentaBancariaId));
    if (!cb) throw new Error("La cuenta bancaria del depósito no existe");

    const [pago] = await tx.select().from(pagos).where(eq(pagos.id, cheque.pagoId));
    if (!pago || pago.estado !== "contabilizado") throw new Error("El pago del cheque no está vigente");
    const [empresa] = await tx
      .select({ monedaFuncionalId: empresas.monedaFuncionalId })
      .from(empresas)
      .where(eq(empresas.id, empresaId));

    // La cuenta del cliente es la misma con que se contabilizó el cobro.
    const [lineaCliente] = await tx
      .select({ cuentaId: asientosLineas.cuentaId })
      .from(asientosLineas)
      .where(and(eq(asientosLineas.asientoId, pago.asientoId!), eq(asientosLineas.terceroId, cheque.terceroId)))
      .limit(1);
    if (!lineaCliente) throw new Error("No se encontró la cuenta del cliente en el asiento del cobro");

    const monto = Number(cheque.monto);
    const gastos = redondear(input.gastosProtesto ?? 0);
    if (gastos > 0) {
      if (!input.cuentaGastoId) throw new Error("Indica la cuenta de gasto para los gastos de protesto");
      const [cg] = await tx
        .select({ activa: planCuentas.activa, imp: planCuentas.nivelImputable, clase: planCuentas.clase, codigo: planCuentas.codigoCuenta })
        .from(planCuentas)
        .where(and(eq(planCuentas.id, input.cuentaGastoId), eq(planCuentas.empresaId, empresaId)));
      if (!cg || !cg.activa || !cg.imp) throw new Error("La cuenta de gasto del protesto no está disponible");
      if (cg.clase !== "Costos y Gastos") throw new Error(`La cuenta ${cg.codigo} debe ser de costos y gastos`);
    }

    // ── Asiento: Dr cliente (+ gasto) / Cr banco ──
    const glosa = `Protesto cheque N° ${cheque.numero} — pago ${pago.numeroInterno}`;
    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, Number(input.fecha.slice(0, 4)));
    const [asiento] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha: input.fecha,
        glosa,
        tipo: "ajuste",
        origen: "protesto de cheque",
        estado: "contabilizado",
        documentoOrigenId: cheque.id,
        documentoOrigenTabla: "cheques",
      })
      .returning();
    if (!asiento) throw new Error("No se pudo crear el asiento del protesto");
    const linea = (cuentaId: string, debe: number, haber: number, terceroId: string | null, texto: string) => ({
      asientoId: asiento.id,
      cuentaId,
      terceroId,
      glosa: texto,
      montoDebeOrigen: debe.toString(),
      montoHaberOrigen: haber.toString(),
      monedaOrigenId: empresa!.monedaFuncionalId,
      tipoCambioAplicado: "1",
      montoDebeFuncional: debe.toString(),
      montoHaberFuncional: haber.toString(),
      documentoReferenciaId: cheque.id,
    });
    await tx.insert(asientosLineas).values([
      linea(lineaCliente.cuentaId, monto, 0, cheque.terceroId, glosa),
      ...(gastos > 0 ? [linea(input.cuentaGastoId!, gastos, 0, null, `Gastos de protesto cheque N° ${cheque.numero}`)] : []),
      linea(cb.cuentaContableId, 0, redondear(monto + gastos), null, glosa),
    ]);

    // ── Reabre la deuda: reversa proporcional de lo aplicado por este pago ──
    let reabiertos: { documentoId: string; monto: number }[] = [];
    const apl = await tx
      .select()
      .from(pagosDocumentos)
      .where(and(eq(pagosDocumentos.pagoId, pago.id)));
    const positivas = apl.filter((a) => !a.chequeId && Number(a.montoAplicado) > 0);
    const totalPago = Number(pago.montoTotal);
    if (positivas.length && totalPago > 0) {
      const factor = monto / totalPago;
      const reversas = positivas.map((a) => redondear(Number(a.montoAplicado) * factor));
      const objetivo = redondear(positivas.reduce((s, a) => s + Number(a.montoAplicado), 0) * factor);
      const dif = redondear(objetivo - reversas.reduce((s, r) => s + r, 0));
      if (reversas.length) reversas[reversas.length - 1] = redondear(reversas[reversas.length - 1]! + dif);
      const filas = positivas
        .map((a, i) => ({ a, r: reversas[i]! }))
        .filter((x) => x.r > 0.004)
        .map((x) => ({
          pagoId: pago.id,
          documentoCompraId: x.a.documentoCompraId,
          documentoVentaId: x.a.documentoVentaId,
          montoAplicado: (-x.r).toString(),
          chequeId: cheque.id,
        }));
      if (filas.length) await tx.insert(pagosDocumentos).values(filas);
      reabiertos = filas.map((f) => ({
        documentoId: (f.documentoVentaId ?? f.documentoCompraId) as string,
        monto: -Number(f.montoAplicado),
      }));
    }

    const [act] = await tx
      .update(cheques)
      .set({
        estado: "protestado",
        fechaProtesto: input.fecha,
        motivoProtesto: input.motivo,
        asientoProtestoId: asiento.id,
        updatedAt: new Date(),
      })
      .where(eq(cheques.id, chequeId))
      .returning();
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { ...ctx, motivo: input.motivo },
        tabla: "cheques",
        registroId: cheque.id,
        etiqueta: `Cheque N° ${cheque.numero}`,
        accion: "cambio_estado",
        antes: { estado: cheque.estado },
        despues: { estado: "protestado", asientoCorrelativo: correlativo, gastosProtesto: gastos, deudaReabierta: reabiertos },
      });
    }
    return act!;
  });
}
