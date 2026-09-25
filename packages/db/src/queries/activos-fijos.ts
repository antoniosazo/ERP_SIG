import type {
  ActivarObraEnCursoInput,
  ActivoFijoDocTipo,
  ActivoFijoMetodoDep,
  AnularDocumentoActivoFijoInput,
  BajaActivoInput,
  CapitalizarActivoInput,
  CrearActivoFijoInput,
  EjecutarDepreciacionInput,
  LibroContable,
  RegistrarDepreciacionManualInput,
  RegistrarMejoraInput,
  TransferirCentroCostoInput,
  TransferirClaseInput,
} from "@erp/shared";
import { PERIODO_ESTADOS_BLOQUEADOS } from "@erp/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import {
  activosFijos,
  activosFijosClases,
  activosFijosDocumentos,
  activosFijosDocumentosLineas,
  activosFijosValoraciones,
  activosFijosValoresPeriodo,
  asientosContables,
  asientosLineas,
  centrosCosto,
  empresas,
  periodosContables,
  planCuentas,
} from "../schema";
import { resolverCuentaClase } from "./activos-fijos-clases";
import {
  calcularCuotaInmediata,
  calcularCuotaLineal,
  mesesDepreciablesHasta,
  type ParametrosCuota,
} from "./activos-fijos-motor";
import { siguienteCorrelativoAsiento } from "./asientos";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { periodoDe } from "./periodos";
import { sembrarSeriesActivoFijo, siguienteCodigo } from "./series";

const PERIODO_BLOQUEA_AF = new Set<string>(PERIODO_ESTADOS_BLOQUEADOS);

const mesAnteriorDe = (anio: number, mes: number) => (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 });

/**
 * Ramifica por `metodoDep`: "Lineal" cubre tanto el régimen tributario Normal como
 * Acelerada (Fase 3) porque ambos ya traen la vida útil correcta en `vidaUtilMeses`;
 * "Inmediata" es la depreciación instantánea (Fase 3, art. 31 N°5 bis). Cualquier otro
 * valor del enum lanza un error explícito, nunca falla en silencio.
 */
function calcularCuotaPorMetodo(metodoDep: ActivoFijoMetodoDep, parametros: ParametrosCuota, etiquetaActivo: string): number {
  if (metodoDep === "Lineal") return calcularCuotaLineal(parametros);
  if (metodoDep === "Inmediata") return calcularCuotaInmediata(parametros);
  throw new Error(`El método "${metodoDep}" aún no está implementado (activo ${etiquetaActivo})`);
}

// ── Lecturas ─────────────────────────────────────────────────────────────────

export async function listarActivosFijos(empresaId: string, f: { estado?: string; claseId?: string } = {}) {
  const cond = [eq(activosFijos.empresaId, empresaId)];
  if (f.estado) cond.push(eq(activosFijos.estado, f.estado as never));
  if (f.claseId) cond.push(eq(activosFijos.claseId, f.claseId));
  return db
    .select({
      id: activosFijos.id,
      codigo: activosFijos.codigo,
      descripcion: activosFijos.descripcion,
      estado: activosFijos.estado,
      claseId: activosFijos.claseId,
      claseNombre: activosFijosClases.nombre,
      centroCostoId: activosFijos.centroCostoId,
      fechaAdquisicion: activosFijos.fechaAdquisicion,
    })
    .from(activosFijos)
    .leftJoin(activosFijosClases, eq(activosFijos.claseId, activosFijosClases.id))
    .where(and(...cond))
    .orderBy(asc(activosFijos.codigo));
}

export async function obtenerActivoFijoConDetalle(id: string, empresaId: string) {
  const [activo] = await db
    .select()
    .from(activosFijos)
    .where(and(eq(activosFijos.id, id), eq(activosFijos.empresaId, empresaId)));
  if (!activo) return null;

  const valoraciones = await db
    .select()
    .from(activosFijosValoraciones)
    .where(eq(activosFijosValoraciones.activoId, id));

  const documentos = await db
    .select({
      id: activosFijosDocumentos.id,
      numero: activosFijosDocumentos.numero,
      anio: activosFijosDocumentos.anio,
      tipoDoc: activosFijosDocumentos.tipoDoc,
      estado: activosFijosDocumentos.estado,
      fecha: activosFijosDocumentos.fecha,
      asientoId: activosFijosDocumentos.asientoId,
      libro: activosFijosDocumentosLineas.libro,
      importe: activosFijosDocumentosLineas.importe,
      glosa: activosFijosDocumentosLineas.glosa,
    })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(and(eq(activosFijosDocumentosLineas.activoId, id), eq(activosFijosDocumentos.empresaId, empresaId)))
    .orderBy(desc(activosFijosDocumentos.fecha));

  return { activo, valoraciones, documentos };
}

// ── Correlativo de documento de Activo Fijo ─────────────────────────────────

async function siguienteNumeroDocumentoAF(
  tx: Tx,
  empresaId: string,
  tipoDoc: ActivoFijoDocTipo,
  anio: number,
): Promise<number> {
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${activosFijosDocumentos.numero}), 0)::int` })
    .from(activosFijosDocumentos)
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.tipoDoc, tipoDoc),
        eq(activosFijosDocumentos.anio, anio),
      ),
    );
  return (row?.max ?? 0) + 1;
}

// ── Alta ─────────────────────────────────────────────────────────────────────

async function validarClaseCentroYMetodos(tx: Tx, empresaId: string, input: CrearActivoFijoInput) {
  const [clase] = await tx
    .select({ id: activosFijosClases.id, activa: activosFijosClases.activa })
    .from(activosFijosClases)
    .where(and(eq(activosFijosClases.id, input.claseId), eq(activosFijosClases.empresaId, empresaId)));
  if (!clase) throw new Error("La clase de activo no existe en esta empresa");
  if (!clase.activa) throw new Error("La clase de activo está inactiva");

  for (const v of input.valoraciones) {
    if (v.metodoDep !== "Lineal" && v.metodoDep !== "Inmediata") {
      throw new Error(`El método "${v.metodoDep}" aún no está implementado`);
    }
    if (v.metodoDep === "Inmediata" && v.regimenDepreciacion !== "Instantanea") {
      throw new Error('El método "Inmediata" solo se usa con el régimen tributario "Instantánea"');
    }
    if (v.regimenDepreciacion !== "Normal" && v.libro !== "Tributario") {
      throw new Error("Los regímenes Acelerada e Instantánea solo se configuran en el libro Tributario");
    }
    if (v.regimenDepreciacion === "Instantanea" && v.metodoDep !== "Inmediata") {
      throw new Error('El régimen "Instantánea" exige el método "Inmediata"');
    }
    if (v.regimenDepreciacion === "Acelerada") {
      if (!v.vidaUtilNormalMeses || v.vidaUtilNormalMeses < 1) {
        throw new Error("El régimen Acelerada exige la vida útil normal (SII), antes de dividir por 3");
      }
      const vidaEsperada = Math.max(12, Math.round(v.vidaUtilNormalMeses / 3));
      if (v.vidaUtilMeses !== vidaEsperada) {
        throw new Error(
          `La vida útil acelerada debe ser la vida útil normal (${v.vidaUtilNormalMeses} meses) dividida por 3 ` +
            `(${vidaEsperada} meses)`,
        );
      }
    }
  }

  if (input.centroCostoId) {
    const [centro] = await tx
      .select({ id: centrosCosto.id })
      .from(centrosCosto)
      .where(and(eq(centrosCosto.id, input.centroCostoId), eq(centrosCosto.empresaId, empresaId)));
    if (!centro) throw new Error("El centro de costo no existe en esta empresa");
  }
}

// ── Costo y depreciación acumulada vigentes (Fase 2) ────────────────────────

async function sumarLineasAF(
  empresaId: string,
  activoId: string,
  libro: LibroContable,
  tipos: ActivoFijoDocTipo[],
): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${activosFijosDocumentosLineas.importe}), 0)` })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.estado, "contabilizado"),
        inArray(activosFijosDocumentos.tipoDoc, tipos),
        eq(activosFijosDocumentosLineas.libro, libro),
        eq(activosFijosDocumentosLineas.activoId, activoId),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Suma el ajuste de dep. acumulada (`depAcumuladaRetirada`) de los tipos de documento dados. */
async function sumarAjusteDepAcumulada(
  empresaId: string,
  activoId: string,
  libro: LibroContable,
  tipos: ActivoFijoDocTipo[],
): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${activosFijosDocumentosLineas.depAcumuladaRetirada}), 0)` })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.estado, "contabilizado"),
        inArray(activosFijosDocumentos.tipoDoc, tipos),
        eq(activosFijosDocumentosLineas.libro, libro),
        eq(activosFijosDocumentosLineas.activoId, activoId),
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * Costo depreciable y depreciación acumulada vigentes de un activo/libro: `CAP` + `MEJ` +
 * `CM` (corrección monetaria, Fase 3) contabilizadas menos el costo retirado por bajas, y
 * `DEP` + `DEP_MAN` contabilizadas menos la dep. acumulada retirada por bajas más la
 * ajustada por CM. Fuente única de verdad (`activos_fijos_documentos_lineas`) —
 * `activos_fijos_valores_periodo` es solo caché de secuenciación del lote mensual, no el
 * saldo real. Usa `db` directo (no `tx`), igual que `periodoDe`: se llama tanto de
 * lecturas sueltas como desde dentro de una transacción, siempre sobre documentos ya
 * contabilizados antes de esa operación.
 */
async function resumenCostoActivo(
  empresaId: string,
  activoId: string,
  libro: LibroContable,
): Promise<{ costo: number; depAcumulada: number }> {
  const altas = await sumarLineasAF(empresaId, activoId, libro, ["CAP", "MEJ", "CM"]);
  const bajasCosto = await sumarLineasAF(empresaId, activoId, libro, ["BAJA_VTA", "BAJA_CAST"]);
  const depreciado = await sumarLineasAF(empresaId, activoId, libro, ["DEP", "DEP_MAN"]);
  const bajasDep = await sumarAjusteDepAcumulada(empresaId, activoId, libro, ["BAJA_VTA", "BAJA_CAST"]);
  const cmDep = await sumarAjusteDepAcumulada(empresaId, activoId, libro, ["CM"]);
  return { costo: altas - bajasCosto, depAcumulada: depreciado - bajasDep + cmDep };
}

export async function crearActivoFijo(empresaId: string, input: CrearActivoFijoInput, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    await validarClaseCentroYMetodos(tx, empresaId, input);
    await sembrarSeriesActivoFijo(tx, empresaId);
    const codigo = await siguienteCodigo(tx, empresaId, "activo_fijo", "codigo");

    const [activo] = await tx
      .insert(activosFijos)
      .values({
        empresaId,
        codigo,
        descripcion: input.descripcion,
        claseId: input.claseId,
        centroCostoId: input.centroCostoId ?? null,
        ubicacion: input.ubicacion ?? null,
        numeroSerie: input.numeroSerie ?? null,
        marca: input.marca ?? null,
        modelo: input.modelo ?? null,
        fechaAdquisicion: input.fechaAdquisicion ?? null,
      })
      .returning();
    if (!activo) throw new Error("No se pudo crear el activo");

    await tx.insert(activosFijosValoraciones).values(
      input.valoraciones.map((v) => ({
        activoId: activo.id,
        libro: v.libro,
        metodoDep: v.metodoDep,
        reglaInicio: v.reglaInicio,
        reglaBaja: v.reglaBaja,
        fechaInicioDep: v.fechaInicioDep,
        vidaUtilMeses: v.vidaUtilMeses,
        valorResidual: v.valorResidual.toString(),
        regimenDepreciacion: v.regimenDepreciacion,
        vidaUtilNormalMeses: v.vidaUtilNormalMeses ?? null,
      })),
    );

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos",
        registroId: activo.id,
        etiqueta: `${activo.codigo} — ${activo.descripcion}`,
        accion: "crear",
        despues: activo,
      });
    }
    return activo;
  });
}

/**
 * Alta automática desde una factura de compra: una línea imputada a una cuenta
 * `tipoCuenta = "ActivoFijo"` crea un activo en estado `Nuevo`, sin clase todavía (el
 * usuario la completa antes de capitalizar). Debe llamarse dentro de la transacción de
 * `contabilizarDocumentoCompra`.
 */
export async function crearActivoDesdeCompra(
  tx: Tx,
  empresaId: string,
  params: { descripcion: string; documentoOrigenId: string; documentoOrigenTabla: string; fechaAdquisicion: string },
  ctx?: AuditoriaCtx,
) {
  await sembrarSeriesActivoFijo(tx, empresaId);
  const codigo = await siguienteCodigo(tx, empresaId, "activo_fijo", "codigo");
  const [activo] = await tx
    .insert(activosFijos)
    .values({
      empresaId,
      codigo,
      descripcion: params.descripcion,
      estado: "Nuevo",
      fechaAdquisicion: params.fechaAdquisicion,
      documentoOrigenId: params.documentoOrigenId,
      documentoOrigenTabla: params.documentoOrigenTabla,
    })
    .returning();
  if (!activo) throw new Error("No se pudo crear el activo desde la factura de compra");
  if (ctx) {
    await registrarAuditoria(tx, {
      empresaId,
      ctx,
      tabla: "activos_fijos",
      registroId: activo.id,
      etiqueta: `${activo.codigo} — ${activo.descripcion}`,
      accion: "crear",
      despues: activo,
    });
  }
  return activo;
}

/**
 * Completa/edita clase, datos y valoraciones de un activo que todavía está en `Nuevo`
 * (antes de capitalizar) — el camino para terminar de configurar un activo que nació
 * automáticamente desde una factura de compra sin clase.
 */
export async function actualizarActivoFijo(
  id: string,
  empresaId: string,
  input: CrearActivoFijoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(activosFijos)
      .where(and(eq(activosFijos.id, id), eq(activosFijos.empresaId, empresaId)));
    if (!antes) throw new Error("El activo no existe en esta empresa");
    if (antes.estado !== "Nuevo") throw new Error("Solo se edita un activo en estado Nuevo (antes de capitalizar)");

    await validarClaseCentroYMetodos(tx, empresaId, input);

    const [activo] = await tx
      .update(activosFijos)
      .set({
        descripcion: input.descripcion,
        claseId: input.claseId,
        centroCostoId: input.centroCostoId ?? null,
        ubicacion: input.ubicacion ?? null,
        numeroSerie: input.numeroSerie ?? null,
        marca: input.marca ?? null,
        modelo: input.modelo ?? null,
        fechaAdquisicion: input.fechaAdquisicion ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(activosFijos.id, id), eq(activosFijos.empresaId, empresaId)))
      .returning();
    if (!activo) throw new Error("No se pudo actualizar el activo");

    await tx.delete(activosFijosValoraciones).where(eq(activosFijosValoraciones.activoId, id));
    await tx.insert(activosFijosValoraciones).values(
      input.valoraciones.map((v) => ({
        activoId: id,
        libro: v.libro,
        metodoDep: v.metodoDep,
        reglaInicio: v.reglaInicio,
        reglaBaja: v.reglaBaja,
        fechaInicioDep: v.fechaInicioDep,
        vidaUtilMeses: v.vidaUtilMeses,
        valorResidual: v.valorResidual.toString(),
        regimenDepreciacion: v.regimenDepreciacion,
        vidaUtilNormalMeses: v.vidaUtilNormalMeses ?? null,
      })),
    );

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos",
        registroId: activo.id,
        etiqueta: `${activo.codigo} — ${activo.descripcion}`,
        accion: "editar",
        antes,
        despues: activo,
      });
    }
    return activo;
  });
}

// ── Capitalización y mejora (comparten el asiento Debe Activo/Haber Compensación) ──

/**
 * Arma y persiste, por cada línea (libro, importe), un documento `tipoDoc` con su
 * asiento Debe cuenta de Activo Fijo / Haber cuenta de Compensación de capitalización.
 * Compartido por `capitalizarActivo` (activo `"Nuevo"` → `"Activo"`) y `registrarMejora`
 * (activo ya `"Activo"`/`"En curso"`, sin cambio de estado) — misma partida doble, solo
 * cambia el tipo de documento y qué hace el llamador con el estado del activo.
 */
async function capitalizarOMejorar(
  tx: Tx,
  empresaId: string,
  activo: typeof activosFijos.$inferSelect,
  input: CapitalizarActivoInput,
  tipoDoc: "CAP" | "MEJ",
  ctx?: AuditoriaCtx,
): Promise<{ documentoId: string; asientoId: string; libro: LibroContable }[]> {
  if (!activo.claseId) throw new Error("El activo no tiene clase asignada");

  const periodo = await periodoDe(empresaId, input.fecha);
  if (!periodo) throw new Error("No hay un periodo contable para la fecha indicada. Genera el ejercicio.");
  if (PERIODO_BLOQUEA_AF.has(periodo.estado)) {
    throw new Error(`El periodo ${periodo.anio}-${String(periodo.mes).padStart(2, "0")} está bloqueado.`);
  }

  const [empresa] = await tx
    .select({ monedaFuncionalId: empresas.monedaFuncionalId })
    .from(empresas)
    .where(eq(empresas.id, empresaId));
  if (!empresa) throw new Error("La empresa no existe");

  const anio = Number(input.fecha.slice(0, 4));
  const etiquetaOperacion = tipoDoc === "CAP" ? "Capitalización" : "Mejora";
  const documentosCreados: { documentoId: string; asientoId: string; libro: LibroContable }[] = [];

  for (const linea of input.lineas) {
    const ctaActivo = await resolverCuentaClase(tx, empresaId, activo.claseId, linea.libro, "ctaActivo", "activo_fijo");
    const ctaComp = await resolverCuentaClase(
      tx,
      empresaId,
      activo.claseId,
      linea.libro,
      "ctaCompensacionCapitalizacion",
      "cuenta_compensacion_capitalizacion",
    );
    if (!ctaActivo) {
      throw new Error(`Configura la cuenta de Activo Fijo (clase o regla GENERAL) para el libro ${linea.libro}.`);
    }
    if (!ctaComp) {
      throw new Error(
        `Configura la cuenta de Compensación de capitalización (clase o regla GENERAL) para el libro ${linea.libro}.`,
      );
    }

    const numero = await siguienteNumeroDocumentoAF(tx, empresaId, tipoDoc, anio);
    const glosaDoc = input.glosa?.trim() || `${etiquetaOperacion} ${activo.codigo} — ${activo.descripcion}`;
    const [documento] = await tx
      .insert(activosFijosDocumentos)
      .values({
        empresaId,
        numero,
        anio,
        tipoDoc,
        estado: "borrador",
        libro: linea.libro,
        fecha: input.fecha,
        fechaContabilizacion: input.fecha,
        glosa: glosaDoc,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!documento) throw new Error(`No se pudo crear el documento de ${etiquetaOperacion.toLowerCase()}`);

    await tx.insert(activosFijosDocumentosLineas).values({
      documentoId: documento.id,
      numeroLinea: 0,
      activoId: activo.id,
      libro: linea.libro,
      importe: linea.importe.toString(),
      glosa: glosaDoc,
    });

    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
    const [asiento] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha: input.fecha,
        glosa: glosaDoc,
        tipo: "automatico",
        origen: "activo fijo",
        libro: linea.libro,
        estado: "contabilizado",
        documentoOrigenId: documento.id,
        documentoOrigenTabla: "activos_fijos_documentos",
      })
      .returning();
    if (!asiento) throw new Error(`No se pudo crear el asiento de ${etiquetaOperacion.toLowerCase()}`);

    await tx.insert(asientosLineas).values([
      {
        asientoId: asiento.id,
        cuentaId: ctaActivo,
        centroCostoId: activo.centroCostoId,
        terceroId: null,
        glosa: glosaDoc,
        montoDebeOrigen: linea.importe.toString(),
        montoHaberOrigen: "0",
        monedaOrigenId: empresa.monedaFuncionalId,
        tipoCambioAplicado: "1",
        montoDebeFuncional: linea.importe.toString(),
        montoHaberFuncional: "0",
        documentoReferenciaId: documento.id,
      },
      {
        asientoId: asiento.id,
        cuentaId: ctaComp,
        centroCostoId: null,
        terceroId: null,
        glosa: glosaDoc,
        montoDebeOrigen: "0",
        montoHaberOrigen: linea.importe.toString(),
        monedaOrigenId: empresa.monedaFuncionalId,
        tipoCambioAplicado: "1",
        montoDebeFuncional: "0",
        montoHaberFuncional: linea.importe.toString(),
        documentoReferenciaId: documento.id,
      },
    ]);

    await tx
      .update(activosFijosDocumentos)
      .set({ estado: "contabilizado", asientoId: asiento.id, updatedAt: new Date() })
      .where(eq(activosFijosDocumentos.id, documento.id));

    documentosCreados.push({ documentoId: documento.id, asientoId: asiento.id, libro: linea.libro });
  }
  return documentosCreados;
}

export async function capitalizarActivo(
  activoId: string,
  empresaId: string,
  input: CapitalizarActivoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [activo] = await tx
      .select()
      .from(activosFijos)
      .where(and(eq(activosFijos.id, activoId), eq(activosFijos.empresaId, empresaId)));
    if (!activo) throw new Error("El activo no existe en esta empresa");
    if (activo.estado !== "Nuevo") throw new Error("Solo se capitaliza un activo en estado Nuevo");
    if (!activo.claseId) throw new Error("Asigna una clase al activo antes de capitalizarlo");

    const valoraciones = await tx
      .select()
      .from(activosFijosValoraciones)
      .where(eq(activosFijosValoraciones.activoId, activoId));
    if (valoraciones.length === 0) throw new Error("El activo no tiene valoraciones configuradas");

    const librosValoracion = new Set(valoraciones.map((v) => v.libro));
    const librosInput = new Set(input.lineas.map((l) => l.libro));
    if (
      librosValoracion.size !== librosInput.size ||
      [...librosValoracion].some((libro) => !librosInput.has(libro))
    ) {
      throw new Error("Las líneas de capitalización deben cubrir exactamente los libros valorados del activo");
    }

    const documentosCreados = await capitalizarOMejorar(tx, empresaId, activo, input, "CAP", ctx);

    const [activoActualizado] = await tx
      .update(activosFijos)
      .set({ estado: "Activo", updatedAt: new Date() })
      .where(eq(activosFijos.id, activoId))
      .returning();
    if (!activoActualizado) throw new Error("No se pudo actualizar el estado del activo");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos",
        registroId: activoId,
        etiqueta: `${activo.codigo} — ${activo.descripcion}`,
        accion: "cambio_estado",
        antes: { estado: "Nuevo" },
        despues: { estado: "Activo", capitalizacion: documentosCreados },
      });
    }
    return { activo: activoActualizado, documentos: documentosCreados };
  });
}

/**
 * Mejora: capitalización adicional sobre un activo ya `"Activo"` o `"En curso"` — mismo
 * asiento que capitalizar, sin exigir `"Nuevo"` ni cambiar el estado. El costo se suma
 * al vigente (`resumenCostoActivo`), así que la próxima depreciación ya lo recoge.
 */
export async function registrarMejora(
  activoId: string,
  empresaId: string,
  input: RegistrarMejoraInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [activo] = await tx
      .select()
      .from(activosFijos)
      .where(and(eq(activosFijos.id, activoId), eq(activosFijos.empresaId, empresaId)));
    if (!activo) throw new Error("El activo no existe en esta empresa");
    if (activo.estado !== "Activo" && activo.estado !== "En curso") {
      throw new Error("Solo se registra una mejora sobre un activo Activo o En curso");
    }

    const valoraciones = await tx
      .select({ libro: activosFijosValoraciones.libro })
      .from(activosFijosValoraciones)
      .where(eq(activosFijosValoraciones.activoId, activoId));
    const librosValoracion = new Set(valoraciones.map((v) => v.libro));
    for (const linea of input.lineas) {
      if (!librosValoracion.has(linea.libro)) {
        throw new Error(`El activo no tiene una valoración para el libro ${linea.libro}`);
      }
    }

    const documentos = await capitalizarOMejorar(tx, empresaId, activo, input, "MEJ", ctx);

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos",
        registroId: activoId,
        etiqueta: `${activo.codigo} — ${activo.descripcion}`,
        accion: "editar",
        despues: { mejora: documentos },
      });
    }
    return { documentos };
  });
}

/**
 * Activa una obra en curso: fija sus valoraciones (si no existían) y pasa
 * `"En curso" → "Activo"`. Sin asiento propio — el costo ya se contabilizó vía las
 * mejoras sucesivas registradas mientras estaba en curso.
 */
export async function activarObraEnCurso(
  activoId: string,
  empresaId: string,
  input: ActivarObraEnCursoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [activo] = await tx
      .select()
      .from(activosFijos)
      .where(and(eq(activosFijos.id, activoId), eq(activosFijos.empresaId, empresaId)));
    if (!activo) throw new Error("El activo no existe en esta empresa");
    if (activo.estado !== "En curso") throw new Error("Solo se activa un activo en estado En curso");

    for (const v of input.valoraciones) {
      if (v.metodoDep !== "Lineal") {
        throw new Error(`El método "${v.metodoDep}" aún no está implementado (solo Lineal)`);
      }
    }

    await tx.delete(activosFijosValoraciones).where(eq(activosFijosValoraciones.activoId, activoId));
    await tx.insert(activosFijosValoraciones).values(
      input.valoraciones.map((v) => ({
        activoId,
        libro: v.libro,
        metodoDep: v.metodoDep,
        reglaInicio: v.reglaInicio,
        reglaBaja: v.reglaBaja,
        fechaInicioDep: v.fechaInicioDep,
        vidaUtilMeses: v.vidaUtilMeses,
        valorResidual: v.valorResidual.toString(),
        regimenDepreciacion: v.regimenDepreciacion,
        vidaUtilNormalMeses: v.vidaUtilNormalMeses ?? null,
      })),
    );

    const [activoActualizado] = await tx
      .update(activosFijos)
      .set({ estado: "Activo", updatedAt: new Date() })
      .where(eq(activosFijos.id, activoId))
      .returning();
    if (!activoActualizado) throw new Error("No se pudo activar la obra en curso");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos",
        registroId: activoId,
        etiqueta: `${activo.codigo} — ${activo.descripcion}`,
        accion: "cambio_estado",
        antes: { estado: "En curso" },
        despues: { estado: "Activo" },
      });
    }
    return activoActualizado;
  });
}

// ── Transferencias ───────────────────────────────────────────────────────────

/** Cambia el centro de costo de un activo. Sin asiento: no es una cuenta contable. */
export async function transferirCentroCosto(
  activoId: string,
  empresaId: string,
  input: TransferirCentroCostoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [activo] = await tx
      .select()
      .from(activosFijos)
      .where(and(eq(activosFijos.id, activoId), eq(activosFijos.empresaId, empresaId)));
    if (!activo) throw new Error("El activo no existe en esta empresa");

    const [centro] = await tx
      .select({ id: centrosCosto.id, codigo: centrosCosto.codigo, nombre: centrosCosto.nombre })
      .from(centrosCosto)
      .where(and(eq(centrosCosto.id, input.centroCostoId), eq(centrosCosto.empresaId, empresaId)));
    if (!centro) throw new Error("El centro de costo no existe en esta empresa");

    const [centroAnterior] = activo.centroCostoId
      ? await tx.select({ codigo: centrosCosto.codigo }).from(centrosCosto).where(eq(centrosCosto.id, activo.centroCostoId))
      : [null];

    const glosaDoc =
      input.glosa?.trim() ||
      `Transferencia de centro de costo: ${centroAnterior?.codigo ?? "sin centro"} → ${centro.codigo}`;

    const anio = Number(input.fecha.slice(0, 4));
    const numero = await siguienteNumeroDocumentoAF(tx, empresaId, "TRF", anio);
    const [documento] = await tx
      .insert(activosFijosDocumentos)
      .values({
        empresaId,
        numero,
        anio,
        tipoDoc: "TRF",
        estado: "contabilizado",
        libro: null,
        fecha: input.fecha,
        fechaContabilizacion: input.fecha,
        glosa: glosaDoc,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!documento) throw new Error("No se pudo crear el documento de transferencia");

    // Línea sin importe (no hay asiento): solo deja rastro del movimiento en la ficha.
    await tx.insert(activosFijosDocumentosLineas).values({
      documentoId: documento.id,
      numeroLinea: 0,
      activoId,
      libro: "Ambos",
      importe: "0",
      glosa: glosaDoc,
    });

    const [activoActualizado] = await tx
      .update(activosFijos)
      .set({ centroCostoId: input.centroCostoId, updatedAt: new Date() })
      .where(eq(activosFijos.id, activoId))
      .returning();
    if (!activoActualizado) throw new Error("No se pudo transferir el activo");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos",
        registroId: activoId,
        etiqueta: `${activo.codigo} — ${activo.descripcion}`,
        accion: "editar",
        antes: { centroCostoId: activo.centroCostoId },
        despues: { centroCostoId: input.centroCostoId, documento: documento.id },
      });
    }
    return { activo: activoActualizado, documentoId: documento.id };
  });
}

/**
 * Cambia la clase de un activo. Si la cuenta de Activo Fijo de la clase destino difiere
 * de la de la clase origen (para algún libro valorado), genera además un asiento de
 * reclasificación (Debe cuenta nueva / Haber cuenta vieja) por el costo vigente de ese
 * libro; si las cuentas son iguales, solo queda el documento de auditoría.
 */
export async function transferirClase(
  activoId: string,
  empresaId: string,
  input: TransferirClaseInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [activo] = await tx
      .select()
      .from(activosFijos)
      .where(and(eq(activosFijos.id, activoId), eq(activosFijos.empresaId, empresaId)));
    if (!activo) throw new Error("El activo no existe en esta empresa");
    if (!activo.claseId) throw new Error("El activo no tiene clase asignada todavía");

    const [claseNueva] = await tx
      .select({ id: activosFijosClases.id, codigo: activosFijosClases.codigo, activa: activosFijosClases.activa })
      .from(activosFijosClases)
      .where(and(eq(activosFijosClases.id, input.claseId), eq(activosFijosClases.empresaId, empresaId)));
    if (!claseNueva) throw new Error("La clase de activo no existe en esta empresa");
    if (!claseNueva.activa) throw new Error("La clase de activo está inactiva");
    if (claseNueva.id === activo.claseId) throw new Error("El activo ya pertenece a esa clase");

    const [claseAnterior] = await tx
      .select({ codigo: activosFijosClases.codigo })
      .from(activosFijosClases)
      .where(eq(activosFijosClases.id, activo.claseId));

    const [empresa] = await tx
      .select({ monedaFuncionalId: empresas.monedaFuncionalId })
      .from(empresas)
      .where(eq(empresas.id, empresaId));
    if (!empresa) throw new Error("La empresa no existe");

    const valoraciones = await tx
      .select({ libro: activosFijosValoraciones.libro })
      .from(activosFijosValoraciones)
      .where(eq(activosFijosValoraciones.activoId, activoId));

    const glosaDoc = input.glosa?.trim() || `Transferencia de clase: ${claseAnterior?.codigo ?? "—"} → ${claseNueva.codigo}`;
    const anio = Number(input.fecha.slice(0, 4));
    const numero = await siguienteNumeroDocumentoAF(tx, empresaId, "TRF_CLASE", anio);
    const [documento] = await tx
      .insert(activosFijosDocumentos)
      .values({
        empresaId,
        numero,
        anio,
        tipoDoc: "TRF_CLASE",
        estado: "contabilizado",
        libro: null,
        fecha: input.fecha,
        fechaContabilizacion: input.fecha,
        glosa: glosaDoc,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!documento) throw new Error("No se pudo crear el documento de transferencia");

    let asientoId: string | null = null;
    let numeroLinea = 0;
    for (const v of valoraciones) {
      const ctaVieja = await resolverCuentaClase(tx, empresaId, activo.claseId, v.libro, "ctaActivo", "activo_fijo");
      const ctaNueva = await resolverCuentaClase(tx, empresaId, claseNueva.id, v.libro, "ctaActivo", "activo_fijo");
      if (!ctaVieja || !ctaNueva) {
        throw new Error(`Configura la cuenta de Activo Fijo (clase o regla GENERAL) para el libro ${v.libro}.`);
      }

      const { costo } = await resumenCostoActivo(empresaId, activoId, v.libro);
      const requiereReclasificacion = ctaVieja !== ctaNueva && costo > 0;

      await tx.insert(activosFijosDocumentosLineas).values({
        documentoId: documento.id,
        numeroLinea: numeroLinea++,
        activoId,
        libro: v.libro,
        importe: (requiereReclasificacion ? costo : 0).toString(),
        glosa: glosaDoc,
      });

      if (!requiereReclasificacion) continue;

      const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
      const [asiento] = await tx
        .insert(asientosContables)
        .values({
          empresaId,
          correlativo,
          fecha: input.fecha,
          glosa: glosaDoc,
          tipo: "automatico",
          origen: "activo fijo",
          libro: v.libro,
          estado: "contabilizado",
          documentoOrigenId: documento.id,
          documentoOrigenTabla: "activos_fijos_documentos",
        })
        .returning();
      if (!asiento) throw new Error("No se pudo crear el asiento de reclasificación");
      asientoId = asiento.id;

      await tx.insert(asientosLineas).values([
        {
          asientoId: asiento.id,
          cuentaId: ctaNueva,
          centroCostoId: activo.centroCostoId,
          terceroId: null,
          glosa: glosaDoc,
          montoDebeOrigen: costo.toString(),
          montoHaberOrigen: "0",
          monedaOrigenId: empresa.monedaFuncionalId,
          tipoCambioAplicado: "1",
          montoDebeFuncional: costo.toString(),
          montoHaberFuncional: "0",
          documentoReferenciaId: documento.id,
        },
        {
          asientoId: asiento.id,
          cuentaId: ctaVieja,
          centroCostoId: activo.centroCostoId,
          terceroId: null,
          glosa: glosaDoc,
          montoDebeOrigen: "0",
          montoHaberOrigen: costo.toString(),
          monedaOrigenId: empresa.monedaFuncionalId,
          tipoCambioAplicado: "1",
          montoDebeFuncional: "0",
          montoHaberFuncional: costo.toString(),
          documentoReferenciaId: documento.id,
        },
      ]);
    }

    if (asientoId) {
      await tx
        .update(activosFijosDocumentos)
        .set({ asientoId, updatedAt: new Date() })
        .where(eq(activosFijosDocumentos.id, documento.id));
    }

    const [activoActualizado] = await tx
      .update(activosFijos)
      .set({ claseId: claseNueva.id, updatedAt: new Date() })
      .where(eq(activosFijos.id, activoId))
      .returning();
    if (!activoActualizado) throw new Error("No se pudo transferir el activo");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos",
        registroId: activoId,
        etiqueta: `${activo.codigo} — ${activo.descripcion}`,
        accion: "editar",
        antes: { claseId: activo.claseId },
        despues: { claseId: claseNueva.id, documento: documento.id },
      });
    }
    return { activo: activoActualizado, documentoId: documento.id };
  });
}

// ── Bajas ────────────────────────────────────────────────────────────────────

/**
 * Da de baja un activo (venta o castigo, total o parcial) mediante la cuenta puente
 * `ctaValorLibroBaja`: Debe Dep. Acumulada (retirada) + Debe puente (valor libro
 * retirado) = Haber Activo (costo retirado); luego Debe/Haber contrapartida (si es
 * venta) contra el puente, y la diferencia entre valor de venta y valor libro va a
 * `ctaUtilidadBaja` (ganancia) o `ctaPerdidaBaja` (pérdida). Un castigo total manda todo
 * el valor libro a `ctaPerdidaBaja`. Con `porcentaje < 100` el activo sigue `"Activo"`
 * y solo se retira esa porción del costo/dep. acumulada; con 100% pasa a
 * `"Dado de baja"`.
 */
export async function bajaActivo(activoId: string, empresaId: string, input: BajaActivoInput, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const [activo] = await tx
      .select()
      .from(activosFijos)
      .where(and(eq(activosFijos.id, activoId), eq(activosFijos.empresaId, empresaId)));
    if (!activo) throw new Error("El activo no existe en esta empresa");
    if (activo.estado !== "Activo") throw new Error("Solo se da de baja un activo en estado Activo");
    if (!activo.claseId) throw new Error("El activo no tiene clase asignada");

    const periodo = await periodoDe(empresaId, input.fecha);
    if (!periodo) throw new Error("No hay un periodo contable para la fecha indicada. Genera el ejercicio.");
    if (PERIODO_BLOQUEA_AF.has(periodo.estado)) {
      throw new Error(`El periodo ${periodo.anio}-${String(periodo.mes).padStart(2, "0")} está bloqueado.`);
    }

    if (input.tipo === "Venta") {
      const [cuentaContrapartida] = await tx
        .select({ id: planCuentas.id })
        .from(planCuentas)
        .where(
          and(
            eq(planCuentas.id, input.cuentaContrapartidaId!),
            eq(planCuentas.empresaId, empresaId),
            eq(planCuentas.activa, true),
            eq(planCuentas.nivelImputable, true),
          ),
        );
      if (!cuentaContrapartida) throw new Error("La cuenta de contrapartida no es válida");
    }

    const valoraciones = await tx
      .select({ libro: activosFijosValoraciones.libro })
      .from(activosFijosValoraciones)
      .where(eq(activosFijosValoraciones.activoId, activoId));
    if (valoraciones.length === 0) throw new Error("El activo no tiene valoraciones configuradas");

    const [empresa] = await tx
      .select({ monedaFuncionalId: empresas.monedaFuncionalId })
      .from(empresas)
      .where(eq(empresas.id, empresaId));
    if (!empresa) throw new Error("La empresa no existe");

    const pct = input.porcentaje / 100;
    const tipoDoc = input.tipo === "Venta" ? "BAJA_VTA" : "BAJA_CAST";
    const etiquetaOperacion = input.tipo === "Venta" ? "Baja por venta" : "Castigo";
    const anio = Number(input.fecha.slice(0, 4));
    const glosaDoc = input.glosa?.trim() || `${etiquetaOperacion} ${activo.codigo} — ${activo.descripcion}`;
    const numero = await siguienteNumeroDocumentoAF(tx, empresaId, tipoDoc, anio);
    const [documento] = await tx
      .insert(activosFijosDocumentos)
      .values({
        empresaId,
        numero,
        anio,
        tipoDoc,
        estado: "borrador",
        libro: null,
        fecha: input.fecha,
        fechaContabilizacion: input.fecha,
        glosa: glosaDoc,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!documento) throw new Error("No se pudo crear el documento de baja");

    let numeroLinea = 0;
    let asientoId: string | null = null;

    for (const v of valoraciones) {
      const { costo, depAcumulada } = await resumenCostoActivo(empresaId, activoId, v.libro);
      if (costo <= 0) continue;

      const costoRetirado = costo * pct;
      const depAcumuladaRetirada = Math.min(depAcumulada * pct, costoRetirado);
      const valorLibroRetirado = costoRetirado - depAcumuladaRetirada;
      // input.valorVenta ya es el efectivo recibido por ESTA baja (parcial o total), no
      // se vuelve a prorratear por porcentaje.
      const valorVentaLinea = input.tipo === "Venta" ? (input.valorVenta ?? 0) : 0;
      const resultado = valorVentaLinea - valorLibroRetirado;

      const ctaActivo = await resolverCuentaClase(tx, empresaId, activo.claseId, v.libro, "ctaActivo", "activo_fijo");
      const ctaDepAcum = await resolverCuentaClase(tx, empresaId, activo.claseId, v.libro, "ctaDepAcumulada", "depreciacion_acumulada");
      const ctaPuente = await resolverCuentaClase(tx, empresaId, activo.claseId, v.libro, "ctaValorLibroBaja", "valor_libro_baja");
      const ctaUtilidad = await resolverCuentaClase(tx, empresaId, activo.claseId, v.libro, "ctaUtilidadBaja", "utilidad_baja");
      const ctaPerdida = await resolverCuentaClase(tx, empresaId, activo.claseId, v.libro, "ctaPerdidaBaja", "perdida_baja");
      if (!ctaActivo) throw new Error(`Configura la cuenta de Activo Fijo (clase o regla GENERAL) para el libro ${v.libro}.`);
      if (!ctaDepAcum) throw new Error(`Configura la cuenta de Depreciación acumulada (clase o regla GENERAL) para el libro ${v.libro}.`);
      if (!ctaPuente) throw new Error(`Configura la cuenta puente de valor libro en baja (clase o regla GENERAL) para el libro ${v.libro}.`);
      if (resultado > 0 && !ctaUtilidad) throw new Error(`Configura la cuenta de Utilidad en baja (clase o regla GENERAL) para el libro ${v.libro}.`);
      if (resultado < 0 && !ctaPerdida) throw new Error(`Configura la cuenta de Pérdida en baja (clase o regla GENERAL) para el libro ${v.libro}.`);

      await tx.insert(activosFijosDocumentosLineas).values({
        documentoId: documento.id,
        numeroLinea: numeroLinea++,
        activoId,
        libro: v.libro,
        importe: costoRetirado.toString(),
        depAcumuladaRetirada: depAcumuladaRetirada.toString(),
        glosa: glosaDoc,
      });

      const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
      const [asiento] = await tx
        .insert(asientosContables)
        .values({
          empresaId,
          correlativo,
          fecha: input.fecha,
          glosa: glosaDoc,
          tipo: "automatico",
          origen: "activo fijo",
          libro: v.libro,
          estado: "contabilizado",
          documentoOrigenId: documento.id,
          documentoOrigenTabla: "activos_fijos_documentos",
        })
        .returning();
      if (!asiento) throw new Error("No se pudo crear el asiento de baja");
      asientoId = asiento.id;

      const filas: {
        cuentaId: string;
        debe: number;
        haber: number;
      }[] = [
        { cuentaId: ctaDepAcum, debe: depAcumuladaRetirada, haber: 0 },
        { cuentaId: ctaActivo, debe: 0, haber: costoRetirado },
      ];
      if (input.tipo === "Venta") {
        filas.push({ cuentaId: input.cuentaContrapartidaId!, debe: valorVentaLinea, haber: 0 });
      }
      if (resultado > 0) filas.push({ cuentaId: ctaUtilidad!, debe: 0, haber: resultado });
      else if (resultado < 0) filas.push({ cuentaId: ctaPerdida!, debe: -resultado, haber: 0 });

      await tx.insert(asientosLineas).values(
        filas
          .filter((f) => f.debe !== 0 || f.haber !== 0)
          .map((f) => ({
            asientoId: asiento.id,
            cuentaId: f.cuentaId,
            centroCostoId: activo.centroCostoId,
            terceroId: null,
            glosa: glosaDoc,
            montoDebeOrigen: f.debe.toString(),
            montoHaberOrigen: f.haber.toString(),
            monedaOrigenId: empresa.monedaFuncionalId,
            tipoCambioAplicado: "1",
            montoDebeFuncional: f.debe.toString(),
            montoHaberFuncional: f.haber.toString(),
            documentoReferenciaId: documento.id,
          })),
      );
    }

    if (!asientoId) throw new Error("El activo no tiene costo vigente en ningún libro: no hay nada que dar de baja.");

    await tx
      .update(activosFijosDocumentos)
      .set({ estado: "contabilizado", asientoId, updatedAt: new Date() })
      .where(eq(activosFijosDocumentos.id, documento.id));

    let activoActualizado = activo;
    if (input.porcentaje >= 100) {
      const [act] = await tx
        .update(activosFijos)
        .set({ estado: "Dado de baja", fechaBaja: input.fecha, updatedAt: new Date() })
        .where(eq(activosFijos.id, activoId))
        .returning();
      if (!act) throw new Error("No se pudo actualizar el estado del activo");
      activoActualizado = act;
    }

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos",
        registroId: activoId,
        etiqueta: `${activo.codigo} — ${activo.descripcion}`,
        accion: "cambio_estado",
        antes: { estado: activo.estado },
        despues: { estado: activoActualizado.estado, baja: documento.id, porcentaje: input.porcentaje },
      });
    }
    return { activo: activoActualizado, documentoId: documento.id };
  });
}

// ── Depreciación ─────────────────────────────────────────────────────────────

type FilaCalculada = {
  activoId: string;
  codigo: string;
  descripcion: string;
  claseId: string;
  centroCostoId: string | null;
  costoDepreciable: number;
  depAcumuladaAlInicio: number;
  cuota: number;
};

async function calcularCuotasDelPeriodo(
  tx: Tx,
  empresaId: string,
  libro: LibroContable,
  periodo: { id: string; anio: number; mes: number },
): Promise<FilaCalculada[]> {
  const activosDelLibro = await tx
    .select({
      activoId: activosFijos.id,
      codigo: activosFijos.codigo,
      descripcion: activosFijos.descripcion,
      claseId: activosFijos.claseId,
      centroCostoId: activosFijos.centroCostoId,
      fechaInicioDep: activosFijosValoraciones.fechaInicioDep,
      reglaInicio: activosFijosValoraciones.reglaInicio,
      vidaUtilMeses: activosFijosValoraciones.vidaUtilMeses,
      valorResidual: activosFijosValoraciones.valorResidual,
      metodoDep: activosFijosValoraciones.metodoDep,
    })
    .from(activosFijos)
    .innerJoin(
      activosFijosValoraciones,
      and(eq(activosFijosValoraciones.activoId, activosFijos.id), eq(activosFijosValoraciones.libro, libro)),
    )
    .where(
      and(
        eq(activosFijos.empresaId, empresaId),
        eq(activosFijos.estado, "Activo"),
        eq(activosFijosValoraciones.bloqueado, false),
      ),
    );
  if (activosDelLibro.length === 0) return [];

  const activoIds = activosDelLibro.map((a) => a.activoId);

  // Costo depreciable vigente: CAP + MEJ + CM (corrección monetaria, Fase 3)
  // contabilizadas, menos el costo retirado por bajas contabilizadas — igual criterio
  // que `resumenCostoActivo`, en bloque para todos los activos del lote (evita N+1 en
  // la ejecución mensual).
  const altas = await tx
    .select({
      activoId: activosFijosDocumentosLineas.activoId,
      total: sql<string>`coalesce(sum(${activosFijosDocumentosLineas.importe}), 0)`,
    })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.estado, "contabilizado"),
        inArray(activosFijosDocumentos.tipoDoc, ["CAP", "MEJ", "CM"]),
        eq(activosFijosDocumentosLineas.libro, libro),
        inArray(activosFijosDocumentosLineas.activoId, activoIds),
      ),
    )
    .groupBy(activosFijosDocumentosLineas.activoId);
  const altasPorActivo = new Map(altas.map((c) => [c.activoId, Number(c.total)]));

  const bajasCosto = await tx
    .select({
      activoId: activosFijosDocumentosLineas.activoId,
      total: sql<string>`coalesce(sum(${activosFijosDocumentosLineas.importe}), 0)`,
    })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.estado, "contabilizado"),
        inArray(activosFijosDocumentos.tipoDoc, ["BAJA_VTA", "BAJA_CAST"]),
        eq(activosFijosDocumentosLineas.libro, libro),
        inArray(activosFijosDocumentosLineas.activoId, activoIds),
      ),
    )
    .groupBy(activosFijosDocumentosLineas.activoId);
  const bajasPorActivo = new Map(bajasCosto.map((c) => [c.activoId, Number(c.total)]));

  const costoPorActivo = new Map(
    activoIds.map((id) => [id, (altasPorActivo.get(id) ?? 0) - (bajasPorActivo.get(id) ?? 0)]),
  );

  const bajasDepAcum = await tx
    .select({
      activoId: activosFijosDocumentosLineas.activoId,
      total: sql<string>`coalesce(sum(${activosFijosDocumentosLineas.depAcumuladaRetirada}), 0)`,
    })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.estado, "contabilizado"),
        inArray(activosFijosDocumentos.tipoDoc, ["BAJA_VTA", "BAJA_CAST"]),
        eq(activosFijosDocumentosLineas.libro, libro),
        inArray(activosFijosDocumentosLineas.activoId, activoIds),
      ),
    )
    .groupBy(activosFijosDocumentosLineas.activoId);
  const bajasDepAcumPorActivo = new Map(bajasDepAcum.map((c) => [c.activoId, Number(c.total)]));

  const cmDepAcum = await tx
    .select({
      activoId: activosFijosDocumentosLineas.activoId,
      total: sql<string>`coalesce(sum(${activosFijosDocumentosLineas.depAcumuladaRetirada}), 0)`,
    })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.estado, "contabilizado"),
        eq(activosFijosDocumentos.tipoDoc, "CM"),
        eq(activosFijosDocumentosLineas.libro, libro),
        inArray(activosFijosDocumentosLineas.activoId, activoIds),
      ),
    )
    .groupBy(activosFijosDocumentosLineas.activoId);
  const cmDepAcumPorActivo = new Map(cmDepAcum.map((c) => [c.activoId, Number(c.total)]));

  const acumuladas = await tx
    .select({
      activoId: activosFijosValoresPeriodo.activoId,
      total: sql<string>`coalesce(sum(${activosFijosValoresPeriodo.depContabilizada}), 0)`,
    })
    .from(activosFijosValoresPeriodo)
    .innerJoin(periodosContables, eq(activosFijosValoresPeriodo.periodoId, periodosContables.id))
    .where(
      and(
        eq(activosFijosValoresPeriodo.libro, libro),
        inArray(activosFijosValoresPeriodo.activoId, activoIds),
        sql`(${periodosContables.anio}, ${periodosContables.mes}) < (${periodo.anio}, ${periodo.mes})`,
      ),
    )
    .groupBy(activosFijosValoresPeriodo.activoId);
  const acumuladaPorActivo = new Map(acumuladas.map((a) => [a.activoId, Number(a.total)]));

  const { anio: anioPrevio, mes: mesPrevio } = mesAnteriorDe(periodo.anio, periodo.mes);

  return activosDelLibro.map((a) => {
    const costoDepreciable = costoPorActivo.get(a.activoId) ?? 0;
    const depAcumuladaAlInicio =
      (acumuladaPorActivo.get(a.activoId) ?? 0) -
      (bajasDepAcumPorActivo.get(a.activoId) ?? 0) +
      (cmDepAcumPorActivo.get(a.activoId) ?? 0);
    const mesesTranscurridosAlInicio = a.fechaInicioDep
      ? mesesDepreciablesHasta(a.fechaInicioDep, a.reglaInicio, anioPrevio, mesPrevio)
      : 0;
    const cuota = calcularCuotaPorMetodo(
      a.metodoDep,
      {
        costoDepreciable,
        valorResidual: Number(a.valorResidual),
        depAcumuladaAlInicio,
        vidaUtilMeses: a.vidaUtilMeses,
        mesesTranscurridosAlInicio,
      },
      a.codigo,
    );
    return {
      activoId: a.activoId,
      codigo: a.codigo,
      descripcion: a.descripcion,
      claseId: a.claseId!,
      centroCostoId: a.centroCostoId,
      costoDepreciable,
      depAcumuladaAlInicio,
      cuota,
    };
  });
}

export type SimulacionDepreciacion = {
  periodo: { anio: number; mes: number };
  libro: LibroContable;
  filas: FilaCalculada[];
  totalCuota: number;
};

export async function ejecutarDepreciacion(
  empresaId: string,
  input: EjecutarDepreciacionInput,
  ctx?: AuditoriaCtx,
): Promise<SimulacionDepreciacion | { documentoId: string; asientoId: string | null; filas: FilaCalculada[]; totalCuota: number }> {
  return db.transaction(async (tx) => {
    const [periodo] = await tx
      .select()
      .from(periodosContables)
      .where(and(eq(periodosContables.id, input.periodoId), eq(periodosContables.empresaId, empresaId)));
    if (!periodo) throw new Error("El periodo no existe en esta empresa");

    const filas = (await calcularCuotasDelPeriodo(tx, empresaId, input.libro, periodo)).filter((f) => f.cuota > 0);
    const totalCuota = filas.reduce((a, f) => a + f.cuota, 0);

    if (input.modo === "simulacion") {
      return { periodo: { anio: periodo.anio, mes: periodo.mes }, libro: input.libro, filas, totalCuota };
    }

    if (PERIODO_BLOQUEA_AF.has(periodo.estado)) {
      throw new Error(`El periodo ${periodo.anio}-${String(periodo.mes).padStart(2, "0")} está bloqueado.`);
    }

    // Secuencia mensual: si ya se ejecutó algún mes de este libro, el inmediatamente
    // anterior al periodo objetivo debe haberlo sido también (no se saltan meses).
    const [ultimaEjecucion] = await tx
      .select({ anio: periodosContables.anio, mes: periodosContables.mes })
      .from(activosFijosValoresPeriodo)
      .innerJoin(periodosContables, eq(activosFijosValoresPeriodo.periodoId, periodosContables.id))
      .where(sql`${activosFijosValoresPeriodo.libro} = ${input.libro} and ${activosFijosValoresPeriodo.depContabilizada} > 0`)
      .orderBy(desc(periodosContables.anio), desc(periodosContables.mes))
      .limit(1);
    if (ultimaEjecucion && filas.length > 0) {
      const esperado = mesAnteriorDe(periodo.anio, periodo.mes);
      const yaEjecutadoEstePeriodo =
        ultimaEjecucion.anio === periodo.anio && ultimaEjecucion.mes === periodo.mes;
      if (
        !yaEjecutadoEstePeriodo &&
        (ultimaEjecucion.anio !== esperado.anio || ultimaEjecucion.mes !== esperado.mes)
      ) {
        throw new Error(
          `Debes ejecutar primero ${esperado.anio}-${String(esperado.mes).padStart(2, "0")} (última ejecución: ` +
            `${ultimaEjecucion.anio}-${String(ultimaEjecucion.mes).padStart(2, "0")}).`,
        );
      }
    }

    if (filas.length === 0) {
      return { documentoId: "", asientoId: null, filas: [], totalCuota: 0 };
    }

    const [empresa] = await tx
      .select({ monedaFuncionalId: empresas.monedaFuncionalId })
      .from(empresas)
      .where(eq(empresas.id, empresaId));
    if (!empresa) throw new Error("La empresa no existe");

    // Resuelve cuentas de gasto/dep. acumulada por clase, consolidando el asiento por
    // (cuenta, centro de costo).
    const porClave = new Map<
      string,
      { cuentaGasto: string; cuentaDepAcum: string; centroCostoId: string | null; monto: number }
    >();
    for (const f of filas) {
      const cuentaGasto = await resolverCuentaClase(tx, empresaId, f.claseId, input.libro, "ctaGastoDep", "gasto_depreciacion");
      const cuentaDepAcum = await resolverCuentaClase(
        tx,
        empresaId,
        f.claseId,
        input.libro,
        "ctaDepAcumulada",
        "depreciacion_acumulada",
      );
      if (!cuentaGasto) throw new Error(`Configura la cuenta de Gasto por depreciación para el activo ${f.codigo}.`);
      if (!cuentaDepAcum) throw new Error(`Configura la cuenta de Depreciación acumulada para el activo ${f.codigo}.`);
      const clave = `${cuentaGasto}::${cuentaDepAcum}::${f.centroCostoId ?? ""}`;
      const acc = porClave.get(clave) ?? { cuentaGasto, cuentaDepAcum, centroCostoId: f.centroCostoId, monto: 0 };
      acc.monto += f.cuota;
      porClave.set(clave, acc);
    }

    const anio = periodo.anio;
    const numero = await siguienteNumeroDocumentoAF(tx, empresaId, "DEP", anio);
    const glosaDoc = `Depreciación ${input.libro} ${periodo.anio}-${String(periodo.mes).padStart(2, "0")}`;
    const [documento] = await tx
      .insert(activosFijosDocumentos)
      .values({
        empresaId,
        numero,
        anio,
        tipoDoc: "DEP",
        estado: "borrador",
        libro: input.libro,
        fecha: periodo.fechaFin,
        fechaContabilizacion: periodo.fechaFin,
        glosa: glosaDoc,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!documento) throw new Error("No se pudo crear el documento de depreciación");

    await tx.insert(activosFijosDocumentosLineas).values(
      filas.map((f, i) => ({
        documentoId: documento.id,
        numeroLinea: i,
        activoId: f.activoId,
        libro: input.libro,
        importe: f.cuota.toString(),
        glosa: `${f.codigo} — ${f.descripcion}`,
      })),
    );

    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
    const [asiento] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha: periodo.fechaFin,
        glosa: glosaDoc,
        tipo: "automatico",
        origen: "activo fijo",
        libro: input.libro,
        estado: "contabilizado",
        documentoOrigenId: documento.id,
        documentoOrigenTabla: "activos_fijos_documentos",
      })
      .returning();
    if (!asiento) throw new Error("No se pudo crear el asiento de depreciación");

    const asientoLineas = [];
    for (const g of porClave.values()) {
      asientoLineas.push({
        asientoId: asiento.id,
        cuentaId: g.cuentaGasto,
        centroCostoId: g.centroCostoId,
        terceroId: null,
        glosa: glosaDoc,
        montoDebeOrigen: g.monto.toString(),
        montoHaberOrigen: "0",
        monedaOrigenId: empresa.monedaFuncionalId,
        tipoCambioAplicado: "1",
        montoDebeFuncional: g.monto.toString(),
        montoHaberFuncional: "0",
        documentoReferenciaId: documento.id,
      });
      asientoLineas.push({
        asientoId: asiento.id,
        cuentaId: g.cuentaDepAcum,
        centroCostoId: null,
        terceroId: null,
        glosa: glosaDoc,
        montoDebeOrigen: "0",
        montoHaberOrigen: g.monto.toString(),
        monedaOrigenId: empresa.monedaFuncionalId,
        tipoCambioAplicado: "1",
        montoDebeFuncional: "0",
        montoHaberFuncional: g.monto.toString(),
        documentoReferenciaId: documento.id,
      });
    }
    await tx.insert(asientosLineas).values(asientoLineas);

    await tx
      .update(activosFijosDocumentos)
      .set({ estado: "contabilizado", asientoId: asiento.id, updatedAt: new Date() })
      .where(eq(activosFijosDocumentos.id, documento.id));

    await tx.insert(activosFijosValoresPeriodo).values(
      filas.map((f) => ({
        activoId: f.activoId,
        libro: input.libro,
        periodoId: periodo.id,
        depPlanificada: f.cuota.toString(),
        depContabilizada: f.cuota.toString(),
      })),
    ).onConflictDoUpdate({
      target: [activosFijosValoresPeriodo.activoId, activosFijosValoresPeriodo.libro, activosFijosValoresPeriodo.periodoId],
      set: { depPlanificada: sql`excluded.dep_planificada`, depContabilizada: sql`excluded.dep_contabilizada`, updatedAt: new Date() },
    });

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos_documentos",
        registroId: documento.id,
        etiqueta: glosaDoc,
        accion: "crear",
        despues: { documento, totalCuota, activos: filas.length },
      });
    }

    return { documentoId: documento.id, asientoId: asiento.id, filas, totalCuota };
  });
}

// ── Depreciación manual ──────────────────────────────────────────────────────

/**
 * Depreciación manual de UN activo/libro/período: reemplaza la cuota calculada por un
 * monto dado por el usuario (corrección puntual, no un lote). Mismo asiento que
 * `ejecutarDepreciacion` (Debe Gasto/Haber Dep. Acumulada) y mismo upsert de
 * `activos_fijos_valores_periodo` — una ejecución automática posterior de ese período
 * para ese activo ya no lo vuelve a tocar (el período ya tiene `depContabilizada`).
 */
export async function registrarDepreciacionManual(
  activoId: string,
  empresaId: string,
  input: RegistrarDepreciacionManualInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [activo] = await tx
      .select()
      .from(activosFijos)
      .where(and(eq(activosFijos.id, activoId), eq(activosFijos.empresaId, empresaId)));
    if (!activo) throw new Error("El activo no existe en esta empresa");
    if (activo.estado !== "Activo") throw new Error("Solo se deprecia un activo en estado Activo");
    if (!activo.claseId) throw new Error("El activo no tiene clase asignada");

    const [periodo] = await tx
      .select()
      .from(periodosContables)
      .where(and(eq(periodosContables.id, input.periodoId), eq(periodosContables.empresaId, empresaId)));
    if (!periodo) throw new Error("El periodo no existe en esta empresa");
    if (PERIODO_BLOQUEA_AF.has(periodo.estado)) {
      throw new Error(`El periodo ${periodo.anio}-${String(periodo.mes).padStart(2, "0")} está bloqueado.`);
    }

    const [valoracion] = await tx
      .select({ bloqueado: activosFijosValoraciones.bloqueado })
      .from(activosFijosValoraciones)
      .where(and(eq(activosFijosValoraciones.activoId, activoId), eq(activosFijosValoraciones.libro, input.libro)));
    if (!valoracion) throw new Error(`El activo no tiene una valoración para el libro ${input.libro}`);
    if (valoracion.bloqueado) throw new Error("La valoración de este libro está bloqueada");

    const cuentaGasto = await resolverCuentaClase(tx, empresaId, activo.claseId, input.libro, "ctaGastoDep", "gasto_depreciacion");
    const cuentaDepAcum = await resolverCuentaClase(
      tx,
      empresaId,
      activo.claseId,
      input.libro,
      "ctaDepAcumulada",
      "depreciacion_acumulada",
    );
    if (!cuentaGasto) throw new Error("Configura la cuenta de Gasto por depreciación (clase o regla GENERAL).");
    if (!cuentaDepAcum) throw new Error("Configura la cuenta de Depreciación acumulada (clase o regla GENERAL).");

    const [empresa] = await tx
      .select({ monedaFuncionalId: empresas.monedaFuncionalId })
      .from(empresas)
      .where(eq(empresas.id, empresaId));
    if (!empresa) throw new Error("La empresa no existe");

    const anio = periodo.anio;
    const glosaDoc =
      input.glosa?.trim() ||
      `Depreciación manual ${activo.codigo} — ${periodo.anio}-${String(periodo.mes).padStart(2, "0")}`;
    const numero = await siguienteNumeroDocumentoAF(tx, empresaId, "DEP_MAN", anio);
    const [documento] = await tx
      .insert(activosFijosDocumentos)
      .values({
        empresaId,
        numero,
        anio,
        tipoDoc: "DEP_MAN",
        estado: "borrador",
        libro: input.libro,
        fecha: periodo.fechaFin,
        fechaContabilizacion: periodo.fechaFin,
        glosa: glosaDoc,
        usuarioCreacionId: ctx?.usuarioId ?? null,
      })
      .returning();
    if (!documento) throw new Error("No se pudo crear el documento de depreciación manual");

    await tx.insert(activosFijosDocumentosLineas).values({
      documentoId: documento.id,
      numeroLinea: 0,
      activoId,
      libro: input.libro,
      importe: input.monto.toString(),
      glosa: glosaDoc,
    });

    const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
    const [asiento] = await tx
      .insert(asientosContables)
      .values({
        empresaId,
        correlativo,
        fecha: periodo.fechaFin,
        glosa: glosaDoc,
        tipo: "automatico",
        origen: "activo fijo",
        libro: input.libro,
        estado: "contabilizado",
        documentoOrigenId: documento.id,
        documentoOrigenTabla: "activos_fijos_documentos",
      })
      .returning();
    if (!asiento) throw new Error("No se pudo crear el asiento de depreciación manual");

    await tx.insert(asientosLineas).values([
      {
        asientoId: asiento.id,
        cuentaId: cuentaGasto,
        centroCostoId: activo.centroCostoId,
        terceroId: null,
        glosa: glosaDoc,
        montoDebeOrigen: input.monto.toString(),
        montoHaberOrigen: "0",
        monedaOrigenId: empresa.monedaFuncionalId,
        tipoCambioAplicado: "1",
        montoDebeFuncional: input.monto.toString(),
        montoHaberFuncional: "0",
        documentoReferenciaId: documento.id,
      },
      {
        asientoId: asiento.id,
        cuentaId: cuentaDepAcum,
        centroCostoId: null,
        terceroId: null,
        glosa: glosaDoc,
        montoDebeOrigen: "0",
        montoHaberOrigen: input.monto.toString(),
        monedaOrigenId: empresa.monedaFuncionalId,
        tipoCambioAplicado: "1",
        montoDebeFuncional: "0",
        montoHaberFuncional: input.monto.toString(),
        documentoReferenciaId: documento.id,
      },
    ]);

    await tx
      .update(activosFijosDocumentos)
      .set({ estado: "contabilizado", asientoId: asiento.id, updatedAt: new Date() })
      .where(eq(activosFijosDocumentos.id, documento.id));

    await tx
      .insert(activosFijosValoresPeriodo)
      .values({
        activoId,
        libro: input.libro,
        periodoId: periodo.id,
        depPlanificada: input.monto.toString(),
        depContabilizada: input.monto.toString(),
      })
      .onConflictDoUpdate({
        target: [
          activosFijosValoresPeriodo.activoId,
          activosFijosValoresPeriodo.libro,
          activosFijosValoresPeriodo.periodoId,
        ],
        set: {
          depPlanificada: sql`excluded.dep_planificada`,
          depContabilizada: sql`excluded.dep_contabilizada`,
          updatedAt: new Date(),
        },
      });

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos_documentos",
        registroId: documento.id,
        etiqueta: glosaDoc,
        accion: "crear",
        despues: { documento, monto: input.monto },
      });
    }

    return { documentoId: documento.id, asientoId: asiento.id };
  });
}

// ── Anulación ────────────────────────────────────────────────────────────────

const TIPOS_ANULABLES = new Set<ActivoFijoDocTipo>(["CAP", "MEJ", "DEP", "DEP_MAN", "BAJA_VTA", "BAJA_CAST"]);

/**
 * Anula un documento de Activo Fijo: reversa contable (nuevo asiento, debe/haber
 * invertidos) + `estado: "anulado"` + `motivoAnulacion` + `asientoReversaId` — mismo
 * patrón que `anularDocumentoCompra`/`anularDocumentoVenta`/`anularPago`. Alcance: `CAP`,
 * `MEJ`, `DEP`, `DEP_MAN`, `BAJA_VTA`, `BAJA_CAST`. Las transferencias (`TRF`/
 * `TRF_CLASE`) no se anulan en esta fase — se deshacen con una transferencia en sentido
 * contrario.
 */
export async function anularDocumentoActivoFijo(
  documentoId: string,
  empresaId: string,
  input: AnularDocumentoActivoFijoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [documento] = await tx
      .select()
      .from(activosFijosDocumentos)
      .where(and(eq(activosFijosDocumentos.id, documentoId), eq(activosFijosDocumentos.empresaId, empresaId)));
    if (!documento) throw new Error("El documento no existe en esta empresa");
    if (documento.estado !== "contabilizado") throw new Error("Solo se anula un documento contabilizado");
    if (!TIPOS_ANULABLES.has(documento.tipoDoc)) {
      throw new Error(`Los documentos de tipo ${documento.tipoDoc} no se anulan en esta fase.`);
    }

    const fechaContab = documento.fechaContabilizacion ?? documento.fecha;
    const periodo = await periodoDe(empresaId, fechaContab);
    if (periodo && PERIODO_BLOQUEA_AF.has(periodo.estado)) {
      throw new Error("El periodo del documento está bloqueado; reábrelo para anular.");
    }

    const lineas = await tx
      .select()
      .from(activosFijosDocumentosLineas)
      .where(eq(activosFijosDocumentosLineas.documentoId, documentoId));

    // DEP/DEP_MAN: solo se permite anular el período más reciente ya ejecutado de ese
    // libro (mismo espíritu que la secuencialidad de `ejecutarDepreciacion`, en reversa).
    const esDepreciacion = documento.tipoDoc === "DEP" || documento.tipoDoc === "DEP_MAN";
    const periodoDoc = esDepreciacion && documento.libro ? await periodoDe(empresaId, documento.fecha) : null;
    if (esDepreciacion && documento.libro && periodoDoc) {
      const [ultimaEjecucion] = await tx
        .select({ anio: periodosContables.anio, mes: periodosContables.mes })
        .from(activosFijosValoresPeriodo)
        .innerJoin(periodosContables, eq(activosFijosValoresPeriodo.periodoId, periodosContables.id))
        .where(
          sql`${activosFijosValoresPeriodo.libro} = ${documento.libro} and ${activosFijosValoresPeriodo.depContabilizada} > 0`,
        )
        .orderBy(desc(periodosContables.anio), desc(periodosContables.mes))
        .limit(1);
      if (ultimaEjecucion && (ultimaEjecucion.anio !== periodoDoc.anio || ultimaEjecucion.mes !== periodoDoc.mes)) {
        throw new Error(
          `Solo se puede anular el período más reciente ejecutado de ${documento.libro} ` +
            `(${ultimaEjecucion.anio}-${String(ultimaEjecucion.mes).padStart(2, "0")}).`,
        );
      }
    }

    let asientoReversaId: string | null = null;
    if (documento.asientoId) {
      const original = await tx.select().from(asientosLineas).where(eq(asientosLineas.asientoId, documento.asientoId));
      const [cab] = await tx.select().from(asientosContables).where(eq(asientosContables.id, documento.asientoId));
      const anio = Number(fechaContab.slice(0, 4));
      const correlativo = await siguienteCorrelativoAsiento(tx, empresaId, anio);
      const [reversa] = await tx
        .insert(asientosContables)
        .values({
          empresaId,
          correlativo,
          fecha: fechaContab,
          glosa: `Reversa: ${cab?.glosa ?? documento.glosa ?? ""}`,
          tipo: "ajuste",
          origen: "anulación activo fijo",
          estado: "contabilizado",
          documentoOrigenId: documento.id,
          documentoOrigenTabla: "activos_fijos_documentos",
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
          documentoReferenciaId: documento.id,
        })),
      );
      asientoReversaId = reversa.id;
    }

    const [documentoActualizado] = await tx
      .update(activosFijosDocumentos)
      .set({ estado: "anulado", motivoAnulacion: input.motivo, asientoReversaId, updatedAt: new Date() })
      .where(eq(activosFijosDocumentos.id, documentoId))
      .returning();
    if (!documentoActualizado) throw new Error("No se pudo anular el documento");

    let activoActualizado: typeof activosFijos.$inferSelect | null = null;
    const activoIdLinea = lineas[0]?.activoId;

    if ((documento.tipoDoc === "CAP" || documento.tipoDoc === "MEJ") && activoIdLinea) {
      const [restante] = await tx
        .select({ total: sql<string>`coalesce(sum(${activosFijosDocumentosLineas.importe}), 0)` })
        .from(activosFijosDocumentosLineas)
        .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
        .where(
          and(
            eq(activosFijosDocumentos.empresaId, empresaId),
            eq(activosFijosDocumentos.estado, "contabilizado"),
            inArray(activosFijosDocumentos.tipoDoc, ["CAP", "MEJ"]),
            eq(activosFijosDocumentosLineas.activoId, activoIdLinea),
          ),
        );
      if (Number(restante?.total ?? 0) === 0) {
        const [act] = await tx
          .update(activosFijos)
          .set({ estado: "Nuevo", updatedAt: new Date() })
          .where(eq(activosFijos.id, activoIdLinea))
          .returning();
        activoActualizado = act ?? null;
      }
    }

    if ((documento.tipoDoc === "BAJA_VTA" || documento.tipoDoc === "BAJA_CAST") && activoIdLinea) {
      const [act] = await tx.select().from(activosFijos).where(eq(activosFijos.id, activoIdLinea));
      if (act?.estado === "Dado de baja") {
        const [actualizado] = await tx
          .update(activosFijos)
          .set({ estado: "Activo", fechaBaja: null, updatedAt: new Date() })
          .where(eq(activosFijos.id, activoIdLinea))
          .returning();
        activoActualizado = actualizado ?? null;
      }
    }

    if (esDepreciacion && periodoDoc) {
      for (const l of lineas) {
        await tx
          .update(activosFijosValoresPeriodo)
          .set({ depContabilizada: "0", updatedAt: new Date() })
          .where(
            and(
              eq(activosFijosValoresPeriodo.activoId, l.activoId),
              eq(activosFijosValoresPeriodo.libro, l.libro),
              eq(activosFijosValoresPeriodo.periodoId, periodoDoc.id),
            ),
          );
      }
    }

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx: { ...ctx, motivo: input.motivo },
        tabla: "activos_fijos_documentos",
        registroId: documentoId,
        etiqueta: documento.glosa ?? documento.tipoDoc,
        accion: "cambio_estado",
        antes: { estado: "contabilizado" },
        despues: { estado: "anulado" },
      });
    }

    return { documento: documentoActualizado, activo: activoActualizado };
  });
}

// ── Pronóstico ───────────────────────────────────────────────────────────────

export type FilaPronostico = {
  anio: number;
  mes: number;
  cuota: number;
  depAcumuladaProyectada: number;
  valorLibroProyectado: number;
};

/**
 * Proyecta la depreciación de los próximos `meses` de un activo/libro a partir del costo
 * y dep. acumulada vigentes (`resumenCostoActivo`) — de solo lectura, no depende de que
 * existan períodos contables futuros generados (usa el calendario directamente).
 */
export async function pronosticoDepreciacion(
  empresaId: string,
  activoId: string,
  libro: LibroContable,
  meses: number,
): Promise<FilaPronostico[]> {
  const [activo] = await db
    .select({ id: activosFijos.id })
    .from(activosFijos)
    .where(and(eq(activosFijos.id, activoId), eq(activosFijos.empresaId, empresaId)));
  if (!activo) throw new Error("El activo no existe en esta empresa");

  const [valoracion] = await db
    .select()
    .from(activosFijosValoraciones)
    .where(and(eq(activosFijosValoraciones.activoId, activoId), eq(activosFijosValoraciones.libro, libro)));
  if (!valoracion) throw new Error(`El activo no tiene una valoración para el libro ${libro}`);
  if (!valoracion.fechaInicioDep) throw new Error("La valoración no tiene fecha de inicio de depreciación");

  const { costo, depAcumulada } = await resumenCostoActivo(empresaId, activoId, libro);

  const hoy = new Date();
  let anio = hoy.getUTCFullYear();
  let mes = hoy.getUTCMonth() + 1;
  let depAcumuladaProyectada = depAcumulada;
  const filas: FilaPronostico[] = [];

  for (let i = 0; i < meses; i++) {
    const { anio: anioPrevio, mes: mesPrevio } = mesAnteriorDe(anio, mes);
    const mesesTranscurridosAlInicio = mesesDepreciablesHasta(valoracion.fechaInicioDep, valoracion.reglaInicio, anioPrevio, mesPrevio);
    const cuota = calcularCuotaPorMetodo(
      valoracion.metodoDep,
      {
        costoDepreciable: costo,
        valorResidual: Number(valoracion.valorResidual),
        depAcumuladaAlInicio: depAcumuladaProyectada,
        vidaUtilMeses: valoracion.vidaUtilMeses,
        mesesTranscurridosAlInicio,
      },
      activoId,
    );
    depAcumuladaProyectada += cuota;
    filas.push({ anio, mes, cuota, depAcumuladaProyectada, valorLibroProyectado: costo - depAcumuladaProyectada });

    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }

  return filas;
}

// ── Informe: Cuadro de evolución ────────────────────────────────────────────

export type FilaCuadroEvolucion = {
  activoId: string;
  codigo: string;
  descripcion: string;
  claseNombre: string;
  costoInicial: number;
  altas: number;
  bajas: number;
  costoFinal: number;
  depAcumuladaInicial: number;
  depEjercicio: number;
  depBajas: number;
  depAcumuladaFinal: number;
  valorLibro: number;
};

/** Suma de `activos_fijos_documentos_lineas` por activo y año, para uno o varios tipos de documento. */
async function sumarPorActivoYAnio(
  empresaId: string,
  libro: LibroContable,
  activoIds: string[],
  tipos: ActivoFijoDocTipo[],
  columna: "importe" | "depAcumuladaRetirada" = "importe",
): Promise<Map<string, Map<number, number>>> {
  const col = columna === "importe" ? activosFijosDocumentosLineas.importe : activosFijosDocumentosLineas.depAcumuladaRetirada;
  const filas = await db
    .select({
      activoId: activosFijosDocumentosLineas.activoId,
      anio: activosFijosDocumentos.anio,
      total: sql<string>`coalesce(sum(${col}), 0)`,
    })
    .from(activosFijosDocumentosLineas)
    .innerJoin(activosFijosDocumentos, eq(activosFijosDocumentosLineas.documentoId, activosFijosDocumentos.id))
    .where(
      and(
        eq(activosFijosDocumentos.empresaId, empresaId),
        eq(activosFijosDocumentos.estado, "contabilizado"),
        inArray(activosFijosDocumentos.tipoDoc, tipos),
        eq(activosFijosDocumentosLineas.libro, libro),
        inArray(activosFijosDocumentosLineas.activoId, activoIds),
      ),
    )
    .groupBy(activosFijosDocumentosLineas.activoId, activosFijosDocumentos.anio);

  const mapa = new Map<string, Map<number, number>>();
  for (const f of filas) {
    const porAnio = mapa.get(f.activoId) ?? new Map<number, number>();
    porAnio.set(f.anio, Number(f.total));
    mapa.set(f.activoId, porAnio);
  }
  return mapa;
}

function sumaHasta(mapa: Map<string, Map<number, number>>, activoId: string, comparador: (anio: number) => boolean): number {
  const porAnio = mapa.get(activoId);
  if (!porAnio) return 0;
  let total = 0;
  for (const [anio, monto] of porAnio) if (comparador(anio)) total += monto;
  return total;
}

export async function cuadroEvolucion(
  empresaId: string,
  libro: LibroContable,
  anio: number,
  f: { claseId?: string; centroCostoId?: string } = {},
): Promise<FilaCuadroEvolucion[]> {
  const condActivo = [eq(activosFijos.empresaId, empresaId)];
  if (f.claseId) condActivo.push(eq(activosFijos.claseId, f.claseId));
  if (f.centroCostoId) condActivo.push(eq(activosFijos.centroCostoId, f.centroCostoId));

  const activosLista = await db
    .select({
      id: activosFijos.id,
      codigo: activosFijos.codigo,
      descripcion: activosFijos.descripcion,
      claseNombre: activosFijosClases.nombre,
    })
    .from(activosFijos)
    .innerJoin(
      activosFijosValoraciones,
      and(eq(activosFijosValoraciones.activoId, activosFijos.id), eq(activosFijosValoraciones.libro, libro)),
    )
    .leftJoin(activosFijosClases, eq(activosFijos.claseId, activosFijosClases.id))
    .where(and(...condActivo))
    .orderBy(asc(activosFijos.codigo));
  if (activosLista.length === 0) return [];
  const activoIds = activosLista.map((a) => a.id);

  const altasPorAnio = await sumarPorActivoYAnio(empresaId, libro, activoIds, ["CAP", "MEJ", "CM"]);
  const bajasPorAnio = await sumarPorActivoYAnio(empresaId, libro, activoIds, ["BAJA_VTA", "BAJA_CAST"]);
  const depPorAnio = await sumarPorActivoYAnio(empresaId, libro, activoIds, ["DEP", "DEP_MAN"]);
  const depBajasPorAnio = await sumarPorActivoYAnio(empresaId, libro, activoIds, ["BAJA_VTA", "BAJA_CAST"], "depAcumuladaRetirada");
  const depCmPorAnio = await sumarPorActivoYAnio(empresaId, libro, activoIds, ["CM"], "depAcumuladaRetirada");

  return activosLista.map((a) => {
    const altasAnteriores = sumaHasta(altasPorAnio, a.id, (y) => y < anio);
    const bajasAnteriores = sumaHasta(bajasPorAnio, a.id, (y) => y < anio);
    const altas = sumaHasta(altasPorAnio, a.id, (y) => y === anio);
    const bajas = sumaHasta(bajasPorAnio, a.id, (y) => y === anio);
    const depAnteriores = sumaHasta(depPorAnio, a.id, (y) => y < anio);
    const depBajasAnteriores = sumaHasta(depBajasPorAnio, a.id, (y) => y < anio);
    const depCmAnteriores = sumaHasta(depCmPorAnio, a.id, (y) => y < anio);
    const depEjercicio = sumaHasta(depPorAnio, a.id, (y) => y === anio);
    const depBajas = sumaHasta(depBajasPorAnio, a.id, (y) => y === anio);
    const depCm = sumaHasta(depCmPorAnio, a.id, (y) => y === anio);

    const costoInicial = altasAnteriores - bajasAnteriores;
    const costoFinal = costoInicial + altas - bajas;
    const depAcumuladaInicial = depAnteriores - depBajasAnteriores + depCmAnteriores;
    const depAcumuladaFinal = depAcumuladaInicial + depEjercicio - depBajas + depCm;
    return {
      activoId: a.id,
      codigo: a.codigo,
      descripcion: a.descripcion,
      claseNombre: a.claseNombre ?? "—",
      costoInicial,
      altas,
      bajas,
      costoFinal,
      depAcumuladaInicial,
      depEjercicio,
      depBajas,
      depAcumuladaFinal,
      valorLibro: costoFinal - depAcumuladaFinal,
    };
  });
}
