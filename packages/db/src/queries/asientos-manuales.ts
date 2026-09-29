import { asientoManualSchema, anularAsientoSchema, fechaConsultaCuentaSchema, totalesAsiento, type AnularAsientoInput, type AsientoManualData, type AsientoTipo } from "@erp/shared";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import {
  asientosContables,
  asientosLineas,
  centrosCosto,
  empresas,
  planCuentas,
  periodosContables,
  pagos,
  monedas,
  terceros,
  tercerosGrupos,
  usuarios,
} from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { siguienteCorrelativoAsiento } from "./asientos";
import {
  periodoAdmiteAsientoManual,
  resolverLineasAsiento,
  validarLibro,
  type LineaResuelta,
} from "./asientos-manuales-reglas";
import { resolverCuentaGeneral } from "./reglas-determinacion-cuenta";

/** Origen de las reversas de asientos manuales (el original queda en `documentoOrigenId`). */
import { referenciasDeAsiento } from "./asientos-referencias";

const TABLA_REVERSA = "asientos_contables";
const etiquetaAsiento = (a: { correlativo: number | null; fecha: string }) =>
  a.correlativo ? `Asiento N° ${a.correlativo} (${a.fecha.slice(0, 4)})` : "Borrador de asiento";

async function validarPeriodo(tx: Tx, empresaId: string, fecha: string) {
  fechaConsultaCuentaSchema.parse(fecha);
  const [per] = await tx.select().from(periodosContables).where(and(
    eq(periodosContables.empresaId, empresaId),
    eq(periodosContables.anio, Number(fecha.slice(0, 4))),
    eq(periodosContables.mes, Number(fecha.slice(5, 7))),
  )).for("share");
  if (!per) throw new Error(`No hay período contable para ${fecha}. Genera el ejercicio.`);
  if (!periodoAdmiteAsientoManual(per.estado)) {
    throw new Error(`El período ${per.anio}-${String(per.mes).padStart(2, "0")} está ${per.estado.toLowerCase()}: no admite asientos.`);
  }
}

// ── Lecturas ────────────────────────────────────────────────────────────────

export type FiltrosAsientos = {
  desde?: string;
  hasta?: string;
  estado?: "borrador" | "contabilizado";
  origen?: "manual" | "automatico";
  texto?: string;
  limite?: number;
};

/** Libro diario: cabeceras con sus totales, más reciente primero. */
export async function listarAsientos(empresaId: string, f: FiltrosAsientos = {}) {
  const reversa = alias(asientosContables, "reversa");
  const texto = f.texto?.trim();
  const numero = texto && /^\d+$/.test(texto) && Number(texto) <= 2147483647 ? Number(texto) : null;
  const rows = await db
    .select({
      id: asientosContables.id,
      correlativo: asientosContables.correlativo,
      fecha: asientosContables.fecha,
      glosa: asientosContables.glosa,
      tipo: asientosContables.tipo,
      origen: asientosContables.origen,
      libro: asientosContables.libro,
      estado: asientosContables.estado,
      referencia: asientosContables.referencia,
      fechaReversa: asientosContables.fechaReversa,
      origenTabla: asientosContables.documentoOrigenTabla,
      origenId: asientosContables.documentoOrigenId,
      totalDebe: sql<string>`coalesce((select sum(${asientosLineas.montoDebeFuncional}) from ${asientosLineas} where ${asientosLineas.asientoId} = ${asientosContables.id}), 0)`,
      totalHaber: sql<string>`coalesce((select sum(${asientosLineas.montoHaberFuncional}) from ${asientosLineas} where ${asientosLineas.asientoId} = ${asientosContables.id}), 0)`,
      reversaId: reversa.id,
      reversaCorrelativo: reversa.correlativo,
    })
    .from(asientosContables)
    .leftJoin(
      reversa,
      and(eq(reversa.documentoOrigenTabla, TABLA_REVERSA), eq(reversa.documentoOrigenId, asientosContables.id)),
    )
    .where(
      and(
        eq(asientosContables.empresaId, empresaId),
        ...(f.desde ? [gte(asientosContables.fecha, f.desde)] : []),
        ...(f.hasta ? [lte(asientosContables.fecha, f.hasta)] : []),
        ...(f.estado ? [eq(asientosContables.estado, f.estado)] : []),
        ...(f.origen === "manual" ? [isNull(asientosContables.documentoOrigenTabla)] : []),
        ...(f.origen === "automatico" ? [isNotNull(asientosContables.documentoOrigenTabla)] : []),
        ...(texto
          ? [
              or(
                ilike(asientosContables.glosa, `%${texto}%`),
                ilike(asientosContables.referencia, `%${texto}%`),
                ...(numero !== null ? [eq(asientosContables.correlativo, numero)] : []),
              )!,
            ]
          : []),
      ),
    )
    .orderBy(desc(asientosContables.fecha), sql`${asientosContables.correlativo} desc nulls first`, desc(asientosContables.id))
    .limit(Math.min(f.limite ?? 300, 1000));
  return rows.map((r) => ({
    ...r,
    totalDebe: Number(r.totalDebe),
    totalHaber: Number(r.totalHaber),
    esManual: r.origenTabla === null,
  }));
}

export type AsientoListado = Awaited<ReturnType<typeof listarAsientos>>[number];

/** Asiento con sus líneas, su reversa (si la tiene) y el original (si es una reversa). */
export async function obtenerAsiento(empresaId: string, asientoId: string) {
  const [cab] = await db
    .select({ a: asientosContables, usuario: usuarios.nombre })
    .from(asientosContables)
    .leftJoin(usuarios, eq(usuarios.id, asientosContables.usuarioId))
    .where(and(eq(asientosContables.id, asientoId), eq(asientosContables.empresaId, empresaId)));
  if (!cab) return null;
  const lineas = await db
    .select({
      id: asientosLineas.id,
      cuentaId: asientosLineas.cuentaId,
      cuentaCodigo: planCuentas.codigoCuenta,
      cuentaNombre: planCuentas.nombreCuenta,
      terceroId: asientosLineas.terceroId,
      tercero: terceros.razonSocial,
      terceroRut: terceros.rut,
      centroCostoId: asientosLineas.centroCostoId,
      centroCosto: centrosCosto.codigo,
      centroCostoNombre: centrosCosto.nombre,
      documentoReferenciaId: asientosLineas.documentoReferenciaId,
      monedaId: asientosLineas.monedaOrigenId,
      moneda: monedas.codigo,
      debeOrigen: asientosLineas.montoDebeOrigen,
      haberOrigen: asientosLineas.montoHaberOrigen,
      tipoCambio: asientosLineas.tipoCambioAplicado,
      glosa: asientosLineas.glosa,
      debe: asientosLineas.montoDebeFuncional,
      haber: asientosLineas.montoHaberFuncional,
    })
    .from(asientosLineas)
    .innerJoin(planCuentas, eq(planCuentas.id, asientosLineas.cuentaId))
    .leftJoin(terceros, eq(terceros.id, asientosLineas.terceroId))
    .leftJoin(centrosCosto, and(eq(centrosCosto.id, asientosLineas.centroCostoId), eq(centrosCosto.empresaId, empresaId)))
    .leftJoin(monedas, eq(monedas.id, asientosLineas.monedaOrigenId))
    .where(eq(asientosLineas.asientoId, asientoId))
    .orderBy(asc(asientosLineas.createdAt), asc(asientosLineas.id));

  const [reversa] = await db
    .select({ id: asientosContables.id, correlativo: asientosContables.correlativo, fecha: asientosContables.fecha })
    .from(asientosContables)
    .where(
      and(
        eq(asientosContables.empresaId, empresaId),
        eq(asientosContables.documentoOrigenTabla, TABLA_REVERSA),
        eq(asientosContables.documentoOrigenId, asientoId),
      ),
    );
  const original =
    cab.a.documentoOrigenTabla === TABLA_REVERSA && cab.a.documentoOrigenId
      ? (
          await db
            .select({ id: asientosContables.id, correlativo: asientosContables.correlativo, fecha: asientosContables.fecha })
            .from(asientosContables)
            .where(and(eq(asientosContables.id, cab.a.documentoOrigenId), eq(asientosContables.empresaId, empresaId)))
        )[0] ?? null
      : null;

  const [pago] = cab.a.documentoOrigenTabla === "pagos" && cab.a.documentoOrigenId
    ? await db.select({ tipo: pagos.tipo }).from(pagos).where(and(eq(pagos.id, cab.a.documentoOrigenId), eq(pagos.empresaId, empresaId)))
    : [];
  const referencias = await referenciasDeAsiento(empresaId, [
    ...lineas.flatMap((l) => l.documentoReferenciaId ? [l.documentoReferenciaId] : []),
    ...(cab.a.documentoOrigenId ? [cab.a.documentoOrigenId] : []),
  ]);
  const [funcional] = await db.select({ id: monedas.id, codigo: monedas.codigo }).from(empresas)
    .innerJoin(monedas, eq(monedas.id, empresas.monedaFuncionalId)).where(eq(empresas.id, empresaId));
  const lineasNum = lineas.map((l) => ({ ...l, debe: Number(l.debe), haber: Number(l.haber) }));
  return {
    asiento: cab.a,
    usuario: cab.usuario,
    referencias,
    monedaFuncional: funcional ?? null,
    pagoTipo: pago?.tipo ?? null,
    esManual: cab.a.documentoOrigenTabla === null,
    lineas: lineasNum,
    totales: totalesAsiento(lineasNum),
    reversa: reversa ?? null,
    original,
  };
}

export type AsientoDetalle = NonNullable<Awaited<ReturnType<typeof obtenerAsiento>>>;

// ── Maestros y resolución de líneas ─────────────────────────────────────────

async function cargarMaestros(tx: Tx, empresaId: string, input: AsientoManualData) {
  const terceroIds = [...new Set(input.lineas.map((l) => l.terceroId).filter((x): x is string => !!x))];
  const ccIds = [...new Set(input.lineas.map((l) => l.centroCostoId).filter((x): x is string => !!x))];

  const ters = terceroIds.length
    ? await tx
        .select({
          id: terceros.id,
          razonSocial: terceros.razonSocial,
          activo: terceros.activo,
          tipoTercero: terceros.tipoTercero,
          cuentaPropia: terceros.cuentaContableAsociadaId,
          cuentaGrupo: tercerosGrupos.cuentaContableAsociadaId,
        })
        .from(terceros)
        .leftJoin(tercerosGrupos, eq(tercerosGrupos.id, terceros.grupoId))
        .where(and(eq(terceros.empresaId, empresaId), inArray(terceros.id, terceroIds)))
    : [];

  // Cuenta asociada del socio solo para las líneas que no traen cuenta: tercero → grupo → regla general.
  const cuentaDeTercero = new Map<string, string | null>();
  const sinCuenta = new Set(input.lineas.filter((l) => !l.cuentaId && l.terceroId).map((l) => l.terceroId!));
  for (const t of ters) {
    if (!sinCuenta.has(t.id)) continue;
    const esCliente = t.tipoTercero === "Cliente";
    cuentaDeTercero.set(
      t.id,
      t.cuentaPropia ??
        t.cuentaGrupo ??
        (await resolverCuentaGeneral(tx, empresaId, esCliente ? "venta" : "compra", esCliente ? "cuenta_por_cobrar" : "cuenta_por_pagar")),
    );
  }

  const cuentaIds = [
    ...new Set([
      ...input.lineas.map((l) => l.cuentaId).filter((x): x is string => !!x),
      ...[...cuentaDeTercero.values()].filter((x): x is string => !!x),
    ]),
  ];
  const cuentas = cuentaIds.length
    ? await tx
        .select({
          id: planCuentas.id,
          codigoCuenta: planCuentas.codigoCuenta,
          nombreCuenta: planCuentas.nombreCuenta,
          activa: planCuentas.activa,
          nivelImputable: planCuentas.nivelImputable,
          tipoCuenta: planCuentas.tipoCuenta,
          requiereCentroCosto: planCuentas.requiereCentroCosto,
          requiereAnalisisTerceros: planCuentas.requiereAnalisisTerceros,
          modoMoneda: planCuentas.modoMoneda,
        })
        .from(planCuentas)
        .where(and(eq(planCuentas.empresaId, empresaId), inArray(planCuentas.id, cuentaIds)))
    : [];
  const ccs = ccIds.length
    ? await tx
        .select({ id: centrosCosto.id, codigo: centrosCosto.codigo, estado: centrosCosto.estado })
        .from(centrosCosto)
        .where(and(eq(centrosCosto.empresaId, empresaId), inArray(centrosCosto.id, ccIds)))
    : [];

  return {
    cuentas: new Map(cuentas.map((c) => [c.id, c])),
    terceros: new Map(ters.map((t) => [t.id, t])),
    centrosCosto: new Map(ccs.map((c) => [c.id, c])),
    cuentaDeTercero,
  };
}

function filasLineas(asientoId: string, monedaId: string, lineas: LineaResuelta[]) {
  return lineas.map((l) => ({
    asientoId,
    cuentaId: l.cuentaId,
    centroCostoId: l.centroCostoId,
    terceroId: l.terceroId,
    glosa: l.glosa,
    montoDebeOrigen: l.debe.toString(),
    montoHaberOrigen: l.haber.toString(),
    monedaOrigenId: monedaId,
    tipoCambioAplicado: "1",
    montoDebeFuncional: l.debe.toString(),
    montoHaberFuncional: l.haber.toString(),
  }));
}

// ── Guardar (crear / editar borrador, opcionalmente contabilizando) ─────────

/**
 * Crea un asiento manual o actualiza un borrador. Con `contabilizar` queda definitivo:
 * recibe correlativo y desde ahí es inmutable (se corrige anulándolo, como en SAP B1).
 */
export async function guardarAsientoManual(
  empresaId: string,
  input: AsientoManualData,
  asientoId: string | null,
  ctx?: AuditoriaCtx,
) {
  input = asientoManualSchema.parse(input);
  // El período permanece bloqueado para lectura hasta confirmar la transacción.
  return db.transaction(async (tx) => {
    if (input.contabilizar) await validarPeriodo(tx, empresaId, input.fecha);
    const [empresa] = await tx
      .select({ monedaFuncionalId: empresas.monedaFuncionalId, aplicaIfrs: empresas.aplicaIfrs })
      .from(empresas)
      .where(eq(empresas.id, empresaId));
    if (!empresa) throw new Error("La empresa no existe");
    validarLibro(input.libro, empresa.aplicaIfrs);

    const maestros = await cargarMaestros(tx, empresaId, input);
    const lineas = resolverLineasAsiento(input.lineas, maestros, input.glosa);
    const totales = totalesAsiento(lineas);
    if (input.contabilizar && !totales.cuadra) {
      throw new Error(`El asiento no cuadra: debe ${totales.debe} vs. haber ${totales.haber}`);
    }

    let antes: typeof asientosContables.$inferSelect | undefined;
    if (asientoId) {
      [antes] = await tx
        .select()
        .from(asientosContables)
        .where(and(eq(asientosContables.id, asientoId), eq(asientosContables.empresaId, empresaId)))
        .for("update");
      if (!antes) throw new Error("El asiento no existe en esta empresa");
      if (antes.documentoOrigenTabla) throw new Error("Este asiento lo generó otro módulo: se corrige desde su documento origen");
      if (antes.estado !== "borrador") throw new Error("El asiento ya está contabilizado: para corregirlo, anúlalo");
    }

    const estado = input.contabilizar ? ("contabilizado" as const) : ("borrador" as const);
    const correlativo = input.contabilizar
      ? await siguienteCorrelativoAsiento(tx, empresaId, Number(input.fecha.slice(0, 4)))
      : null;
    const valores = {
      fecha: input.fecha,
      glosa: input.glosa,
      tipo: input.tipo as AsientoTipo,
      libro: input.libro,
      referencia: input.referencia || null,
      fechaReversa: input.fechaReversa || null,
      estado,
      correlativo,
    };

    let id: string;
    if (antes) {
      await tx.update(asientosContables).set({ ...valores, updatedAt: new Date() }).where(eq(asientosContables.id, antes.id));
      await tx.delete(asientosLineas).where(eq(asientosLineas.asientoId, antes.id));
      id = antes.id;
    } else {
      const [nuevo] = await tx
        .insert(asientosContables)
        .values({ ...valores, empresaId, origen: "manual", usuarioId: ctx?.usuarioId ?? null })
        .returning({ id: asientosContables.id });
      if (!nuevo) throw new Error("No se pudo crear el asiento");
      id = nuevo.id;
    }
    await tx.insert(asientosLineas).values(filasLineas(id, empresa.monedaFuncionalId, lineas));

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "asientos_contables",
        registroId: id,
        etiqueta: etiquetaAsiento({ correlativo, fecha: input.fecha }),
        accion: antes ? (input.contabilizar ? "cambio_estado" : "editar") : "crear",
        antes: antes ? { estado: antes.estado, fecha: antes.fecha, glosa: antes.glosa } : undefined,
        despues: { ...valores, total: totales.debe, lineas: lineas.length },
      });
    }
    return { id, correlativo, estado };
  });
}

/** Elimina un borrador (los contabilizados nunca se borran). */
export async function eliminarBorradorAsiento(empresaId: string, asientoId: string, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const [a] = await tx
      .select()
      .from(asientosContables)
      .where(and(eq(asientosContables.id, asientoId), eq(asientosContables.empresaId, empresaId)))
      .for("update");
    if (!a) throw new Error("El asiento no existe en esta empresa");
    if (a.estado !== "borrador" || a.documentoOrigenTabla) throw new Error("Solo se pueden eliminar borradores de asientos manuales");
    await tx.delete(asientosContables).where(eq(asientosContables.id, a.id));
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "asientos_contables",
        registroId: a.id,
        etiqueta: etiquetaAsiento(a),
        accion: "eliminar",
        antes: { fecha: a.fecha, glosa: a.glosa, estado: a.estado },
      });
    }
  });
}

// ── Anular / revertir ───────────────────────────────────────────────────────

/**
 * Crea la reversa (debe ↔ haber) de un asiento manual contabilizado. El original sigue
 * contabilizado: la reversa lo neutraliza en los saldos, igual que "Cancelar" en SAP B1.
 */
async function revertirAsiento(tx: Tx, empresaId: string, asientoId: string, fecha: string, glosaReversa?: string) {
  const [a] = await tx
    .select()
    .from(asientosContables)
    .where(and(eq(asientosContables.id, asientoId), eq(asientosContables.empresaId, empresaId)))
    .for("update");
  if (!a) throw new Error("El asiento no existe en esta empresa");
  if (a.documentoOrigenTabla) throw new Error("Este asiento lo generó otro módulo: se anula desde su documento origen");
  if (a.estado !== "contabilizado") throw new Error("Solo se revierten asientos contabilizados");
  if (fecha < a.fecha) throw new Error("La reversa no puede tener fecha anterior al asiento original");
  const [yaRevertido] = await tx
    .select({ correlativo: asientosContables.correlativo })
    .from(asientosContables)
    .where(and(eq(asientosContables.documentoOrigenTabla, TABLA_REVERSA), eq(asientosContables.documentoOrigenId, a.id)));
  if (yaRevertido) throw new Error(`El asiento ya fue revertido (asiento N° ${yaRevertido.correlativo})`);

  const lineas = await tx.select().from(asientosLineas).where(eq(asientosLineas.asientoId, a.id));
  const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, Number(fecha.slice(0, 4)));
  const [reversa] = await tx
    .insert(asientosContables)
    .values({
      empresaId,
      correlativo,
      fecha,
      glosa: glosaReversa ?? `Reversa: ${a.glosa}`,
      tipo: a.tipo,
      origen: "reversa asiento manual",
      libro: a.libro,
      estado: "contabilizado",
      referencia: a.referencia,
      documentoOrigenId: a.id,
      documentoOrigenTabla: TABLA_REVERSA,
    })
    .returning();
  if (!reversa) throw new Error("No se pudo crear el asiento de reversa");
  await tx.insert(asientosLineas).values(
    lineas.map((l) => ({
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
      documentoReferenciaId: l.documentoReferenciaId,
    })),
  );
  return { original: a, reversa };
}

export async function anularAsientoManual(
  empresaId: string,
  asientoId: string,
  input: AnularAsientoInput,
  ctx?: AuditoriaCtx,
) {
  input = anularAsientoSchema.parse(input);
  return db.transaction(async (tx) => {
    await validarPeriodo(tx, empresaId, input.fecha);
    const { original, reversa } = await revertirAsiento(tx, empresaId, asientoId, input.fecha);
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { ...ctx, motivo: input.motivo },
        tabla: "asientos_contables",
        registroId: original.id,
        etiqueta: etiquetaAsiento(original),
        accion: "cambio_estado",
        antes: { estado: "contabilizado" },
        despues: { anulado: true, reversa: reversa.correlativo, fechaReversa: input.fecha },
      });
    }
    return reversa;
  });
}

/** Asientos manuales marcados "Revertir" cuya fecha de reversión ya llegó y aún no se revierten. */
export async function listarReversionesPendientes(empresaId: string, hasta: string) {
  const reversa = alias(asientosContables, "reversa");
  return db
    .select({
      id: asientosContables.id,
      correlativo: asientosContables.correlativo,
      fecha: asientosContables.fecha,
      fechaReversa: asientosContables.fechaReversa,
      glosa: asientosContables.glosa,
    })
    .from(asientosContables)
    .leftJoin(
      reversa,
      and(eq(reversa.documentoOrigenTabla, TABLA_REVERSA), eq(reversa.documentoOrigenId, asientosContables.id)),
    )
    .where(
      and(
        eq(asientosContables.empresaId, empresaId),
        eq(asientosContables.estado, "contabilizado"),
        isNull(asientosContables.documentoOrigenTabla),
        isNotNull(asientosContables.fechaReversa),
        lte(asientosContables.fechaReversa, hasta),
        isNull(reversa.id),
      ),
    )
    .orderBy(asc(asientosContables.fechaReversa), asc(asientosContables.correlativo));
}

/**
 * Ejecuta las reversiones programadas (SAP: Finanzas → Revertir transacciones). Cada una
 * se contabiliza en su fecha de reversión; las de períodos bloqueados se informan y quedan
 * pendientes.
 */
export async function ejecutarReversionesPendientes(empresaId: string, hasta: string, ctx?: AuditoriaCtx) {
  const pendientes = await listarReversionesPendientes(empresaId, hasta);
  const hechas: { original: number | null; reversa: number | null }[] = [];
  const errores: string[] = [];
  for (const p of pendientes) {
    try {
      const hecha = await db.transaction(async (tx) => {
        await validarPeriodo(tx, empresaId, p.fechaReversa!);
        const { original, reversa } = await revertirAsiento(tx, empresaId, p.id, p.fechaReversa!);
        if (ctx) {
          await registrarAuditoria(tx, {
            empresaId,
            ctx,
            tabla: "asientos_contables",
            registroId: original.id,
            etiqueta: etiquetaAsiento(original),
            accion: "cambio_estado",
            despues: { reversionProgramada: true, reversa: reversa.correlativo, fechaReversa: p.fechaReversa },
          });
        }
        return { original: original.correlativo, reversa: reversa.correlativo };
      });
      hechas.push(hecha);
    } catch (e) {
      errores.push(`Asiento N° ${p.correlativo}: ${e instanceof Error ? e.message : "error desconocido"}`);
    }
  }
  return { hechas, errores };
}
