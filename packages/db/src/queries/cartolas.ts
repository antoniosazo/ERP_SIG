import type { ConfirmarImportacionCartolaInput, FilaCartolaMapeada } from "@erp/shared";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { cartolas, cartolasMovimientos, cuentasBancarias } from "../schema";
import { periodoDe } from "./periodos";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

const EPSILON = 0.01;

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Huella para deduplicar un movimiento entre cartolas de una misma cuenta (sección 5.4). */
function calcularHuella(cuentaBancariaId: string, f: Pick<FilaCartolaMapeada, "fecha" | "monto" | "nroDocumento" | "descripcion">) {
  const base = `${cuentaBancariaId}|${f.fecha}|${redondear(f.monto).toFixed(2)}|${f.nroDocumento ?? ""}|${f.descripcion}`;
  return createHash("sha256").update(base).digest("hex");
}

/** Depósitos y protestos son movimientos de cobranza (`cheques.ts`); cartolas es análogo:
 * importar no contabiliza, así que solo bloquea un período totalmente "Bloqueado". */
async function periodoBloqueadoParaFecha(empresaId: string, fecha: string): Promise<string | null> {
  const per = await periodoDe(empresaId, fecha);
  if (!per) return "No hay un período contable para esa fecha. Genera el ejercicio.";
  if (per.estado === "Bloqueado") {
    return `El período ${per.anio}-${String(per.mes).padStart(2, "0")} está bloqueado.`;
  }
  return null;
}

async function validarCuentaBancaria(empresaId: string, cuentaBancariaId: string) {
  const [cb] = await db
    .select()
    .from(cuentasBancarias)
    .where(and(eq(cuentasBancarias.id, cuentaBancariaId), eq(cuentasBancarias.empresaId, empresaId)));
  if (!cb) throw new Error("La cuenta bancaria no pertenece a esta empresa");
  if (!cb.activa) throw new Error("La cuenta bancaria está inactiva");
  return cb;
}

export type FilaCartolaPrevia = FilaCartolaMapeada & {
  huella: string;
  duplicada: boolean;
  error: string | null;
};

export type PreviaCartola = {
  filas: FilaCartolaPrevia[];
  totalAbonos: number;
  totalCargos: number;
  cuadra: boolean;
  diferenciaCuadratura: number;
  advertenciaSaldoAnterior: string | null;
  bloqueada: boolean;
};

/** De solo lectura: valida una cartola ya parseada/mapeada antes de persistirla (5.3–5.4). */
export async function previsualizarCartola(
  empresaId: string,
  cuentaBancariaId: string,
  filasEntrada: FilaCartolaMapeada[],
  saldoInicial: number,
  saldoFinal: number,
): Promise<PreviaCartola> {
  await validarCuentaBancaria(empresaId, cuentaBancariaId);

  const huellas = filasEntrada.map((f) => calcularHuella(cuentaBancariaId, f));
  const existentes = huellas.length
    ? await db
        .select({ huella: cartolasMovimientos.huella })
        .from(cartolasMovimientos)
        .where(and(eq(cartolasMovimientos.cuentaBancariaId, cuentaBancariaId), inArray(cartolasMovimientos.huella, huellas)))
    : [];
  const huellasExistentes = new Set(existentes.map((e) => e.huella));

  const filas: FilaCartolaPrevia[] = [];
  for (let i = 0; i < filasEntrada.length; i++) {
    const f = filasEntrada[i]!;
    const huella = huellas[i]!;
    const error = await periodoBloqueadoParaFecha(empresaId, f.fecha);
    filas.push({ ...f, huella, duplicada: huellasExistentes.has(huella), error });
  }

  const totalAbonos = redondear(filas.filter((f) => f.monto > 0).reduce((s, f) => s + f.monto, 0));
  const totalCargos = redondear(Math.abs(filas.filter((f) => f.monto < 0).reduce((s, f) => s + f.monto, 0)));
  const saldoCalculado = redondear(saldoInicial + totalAbonos - totalCargos);
  const diferenciaCuadratura = redondear(saldoCalculado - saldoFinal);
  const cuadra = Math.abs(diferenciaCuadratura) <= EPSILON;

  const [anterior] = await db
    .select({ saldoFinal: cartolas.saldoFinal, fechaHasta: cartolas.fechaHasta })
    .from(cartolas)
    .where(and(eq(cartolas.cuentaBancariaId, cuentaBancariaId), eq(cartolas.estado, "Importada")))
    .orderBy(desc(cartolas.fechaHasta))
    .limit(1);
  const advertenciaSaldoAnterior =
    anterior && Math.abs(Number(anterior.saldoFinal) - saldoInicial) > EPSILON
      ? `El saldo inicial no coincide con el saldo final de la última cartola importada (${anterior.fechaHasta}: ${anterior.saldoFinal}). Revisa si falta un período.`
      : null;

  const bloqueada = !cuadra || filas.some((f) => f.error);
  return { filas, totalAbonos, totalCargos, cuadra, diferenciaCuadratura, advertenciaSaldoAnterior, bloqueada };
}

async function persistirCartola(
  tx: Tx,
  empresaId: string,
  cuentaBancariaId: string,
  input: {
    origen: "Archivo" | "Manual";
    archivoNombre: string | null;
    archivoHash: string | null;
    fechaDesde: string;
    fechaHasta: string;
    saldoInicial: number;
    saldoFinal: number;
  },
  filas: FilaCartolaMapeada[],
  ctx?: AuditoriaCtx,
) {
  const [cartola] = await tx
    .insert(cartolas)
    .values({
      empresaId,
      cuentaBancariaId,
      fechaDesde: input.fechaDesde,
      fechaHasta: input.fechaHasta,
      saldoInicial: input.saldoInicial.toString(),
      saldoFinal: input.saldoFinal.toString(),
      origen: input.origen,
      archivoNombre: input.archivoNombre,
      archivoHash: input.archivoHash,
      usuarioId: ctx?.usuarioId ?? null,
    })
    .returning();
  if (!cartola) throw new Error("No se pudo crear la cartola");

  await tx.insert(cartolasMovimientos).values(
    filas.map((f) => ({
      cartolaId: cartola.id,
      cuentaBancariaId,
      fecha: f.fecha,
      descripcion: f.descripcion,
      nroDocumento: f.nroDocumento || null,
      rutContraparte: f.rutContraparte || null,
      monto: f.monto.toString(),
      codigoTransaccion: f.codigoTransaccion || null,
      huella: calcularHuella(cuentaBancariaId, f),
    })),
  );

  if (ctx) {
    await registrarAuditoria(tx, {
      empresaId,
      ctx,
      tabla: "cartolas",
      registroId: cartola.id,
      etiqueta: `${input.fechaDesde} a ${input.fechaHasta}`,
      accion: "crear",
      despues: { ...cartola, movimientosInsertados: filas.length },
    });
  }
  return { cartola, insertadas: filas.length };
}

/** Revalida (defensivo) y persiste una cartola importada desde archivo. Solo inserta las
 * filas cuya huella no exista ya para esa cuenta — permite reimportar cartolas con días
 * traslapados sin duplicar (sección 5.4). */
export async function confirmarImportacionCartola(
  empresaId: string,
  cuentaBancariaId: string,
  input: ConfirmarImportacionCartolaInput,
  ctx?: AuditoriaCtx,
) {
  const previa = await previsualizarCartola(empresaId, cuentaBancariaId, input.filas, input.saldoInicial, input.saldoFinal);
  if (!previa.cuadra) {
    throw new Error(
      `La cartola no cuadra: saldo inicial + abonos − cargos (${(input.saldoInicial + previa.totalAbonos - previa.totalCargos).toFixed(2)}) no coincide con el saldo final declarado (${input.saldoFinal.toFixed(2)}).`,
    );
  }
  const filaConError = previa.filas.find((f) => f.error);
  if (filaConError) throw new Error(filaConError.error!);

  const filasNuevas = previa.filas.filter((f) => !f.duplicada);
  if (filasNuevas.length === 0) {
    throw new Error("Todos los movimientos de este archivo ya fueron importados anteriormente.");
  }

  return db.transaction((tx) =>
    persistirCartola(
      tx,
      empresaId,
      cuentaBancariaId,
      {
        origen: "Archivo",
        archivoNombre: input.archivoNombre ?? null,
        archivoHash: input.archivoHash ?? null,
        fechaDesde: input.fechaDesde,
        fechaHasta: input.fechaHasta,
        saldoInicial: input.saldoInicial,
        saldoFinal: input.saldoFinal,
      },
      filasNuevas,
      ctx,
    ),
  );
}

/** Carga manual de un movimiento (sección 5.5) — crea una cartola de un solo movimiento. */
export async function agregarMovimientoManual(
  empresaId: string,
  cuentaBancariaId: string,
  fila: FilaCartolaMapeada,
  ctx?: AuditoriaCtx,
) {
  await validarCuentaBancaria(empresaId, cuentaBancariaId);
  const error = await periodoBloqueadoParaFecha(empresaId, fila.fecha);
  if (error) throw new Error(error);

  const huella = calcularHuella(cuentaBancariaId, fila);
  const [existe] = await db
    .select({ id: cartolasMovimientos.id })
    .from(cartolasMovimientos)
    .where(and(eq(cartolasMovimientos.cuentaBancariaId, cuentaBancariaId), eq(cartolasMovimientos.huella, huella)));
  if (existe) throw new Error("Ya existe un movimiento idéntico para esta cuenta.");

  return db.transaction((tx) =>
    persistirCartola(
      tx,
      empresaId,
      cuentaBancariaId,
      {
        origen: "Manual",
        archivoNombre: null,
        archivoHash: null,
        fechaDesde: fila.fecha,
        fechaHasta: fila.fecha,
        saldoInicial: 0,
        saldoFinal: fila.monto,
      },
      [fila],
      ctx,
    ),
  );
}

export async function listarCartolas(empresaId: string, cuentaBancariaId?: string) {
  const condiciones = [eq(cartolas.empresaId, empresaId)];
  if (cuentaBancariaId) condiciones.push(eq(cartolas.cuentaBancariaId, cuentaBancariaId));
  const filas = await db
    .select({
      id: cartolas.id,
      cuentaBancariaId: cartolas.cuentaBancariaId,
      fechaDesde: cartolas.fechaDesde,
      fechaHasta: cartolas.fechaHasta,
      saldoInicial: cartolas.saldoInicial,
      saldoFinal: cartolas.saldoFinal,
      origen: cartolas.origen,
      archivoNombre: cartolas.archivoNombre,
      estado: cartolas.estado,
      createdAt: cartolas.createdAt,
    })
    .from(cartolas)
    .where(and(...condiciones))
    .orderBy(desc(cartolas.fechaHasta));

  const conteos = await db
    .select({ cartolaId: cartolasMovimientos.cartolaId })
    .from(cartolasMovimientos)
    .where(inArray(cartolasMovimientos.cartolaId, filas.map((f) => f.id)));
  const conteoPorCartola = new Map<string, number>();
  for (const c of conteos) conteoPorCartola.set(c.cartolaId, (conteoPorCartola.get(c.cartolaId) ?? 0) + 1);

  return filas.map((f) => ({ ...f, cantidadMovimientos: conteoPorCartola.get(f.id) ?? 0 }));
}

export async function obtenerCartolaConMovimientos(cartolaId: string, empresaId: string) {
  const [cartola] = await db
    .select()
    .from(cartolas)
    .where(and(eq(cartolas.id, cartolaId), eq(cartolas.empresaId, empresaId)));
  if (!cartola) return null;
  const movimientos = await db
    .select()
    .from(cartolasMovimientos)
    .where(eq(cartolasMovimientos.cartolaId, cartolaId))
    .orderBy(asc(cartolasMovimientos.fecha));
  return { ...cartola, movimientos };
}
