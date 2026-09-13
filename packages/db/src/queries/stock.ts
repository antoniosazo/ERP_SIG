import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { productoStock, productos, productosGrupos, stockMovimientos } from "../schema";

const redondear = (x: number, decimales = 4) => {
  const f = 10 ** decimales;
  return Math.round((x + Number.EPSILON) * f) / f;
};

type Exec = Pick<typeof db, "select"> | Tx;

/** Saldo actual de un producto (un almacén implícito por empresa). */
export async function obtenerStock(
  exec: Exec,
  empresaId: string,
  productoId: string,
): Promise<{ cantidad: number; costoPromedio: number } | null> {
  const [row] = await exec
    .select({ cantidad: productoStock.cantidad, costoPromedio: productoStock.costoPromedio })
    .from(productoStock)
    .where(and(eq(productoStock.empresaId, empresaId), eq(productoStock.productoId, productoId)));
  return row ? { cantidad: Number(row.cantidad), costoPromedio: Number(row.costoPromedio) } : null;
}

type OrigenMov = {
  fecha: string;
  origenTabla?: string | null;
  origenId?: string | null;
  glosa?: string | null;
  asientoId?: string | null;
};

/**
 * Entrada de stock con valoración a promedio ponderado móvil:
 * `nuevoProm = (qtyPrev·promPrev + cantidad·costoUnitario) / (qtyPrev + cantidad)`.
 * Debe llamarse dentro de una transacción. Devuelve el costo total de la entrada y el
 * saldo resultante.
 */
export async function aplicarEntradaStock(
  tx: Tx,
  empresaId: string,
  productoId: string,
  entrada: { cantidad: number; costoUnitario: number } & OrigenMov,
) {
  const [saldo] = await tx
    .select()
    .from(productoStock)
    .where(and(eq(productoStock.empresaId, empresaId), eq(productoStock.productoId, productoId)))
    .for("update");

  const qtyPrev = saldo ? Number(saldo.cantidad) : 0;
  const promPrev = saldo ? Number(saldo.costoPromedio) : 0;
  const costoTotal = redondear(entrada.cantidad * entrada.costoUnitario);
  const nuevaQty = redondear(qtyPrev + entrada.cantidad, 6);
  const nuevoProm = nuevaQty > 0 ? redondear((qtyPrev * promPrev + costoTotal) / nuevaQty) : 0;

  if (saldo) {
    await tx
      .update(productoStock)
      .set({ cantidad: nuevaQty.toString(), costoPromedio: nuevoProm.toString(), updatedAt: new Date() })
      .where(eq(productoStock.id, saldo.id));
  } else {
    await tx
      .insert(productoStock)
      .values({
        empresaId,
        productoId,
        cantidad: nuevaQty.toString(),
        costoPromedio: nuevoProm.toString(),
      });
  }

  await tx.insert(stockMovimientos).values({
    empresaId,
    productoId,
    fecha: entrada.fecha,
    tipo: "entrada",
    cantidad: entrada.cantidad.toString(),
    costoUnitario: entrada.costoUnitario.toString(),
    costoTotal: costoTotal.toString(),
    saldoCantidad: nuevaQty.toString(),
    saldoCostoPromedio: nuevoProm.toString(),
    origenTabla: entrada.origenTabla ?? null,
    origenId: entrada.origenId ?? null,
    asientoId: entrada.asientoId ?? null,
    glosa: entrada.glosa ?? null,
  });

  return { costoTotal, saldoCantidad: nuevaQty, saldoCostoPromedio: nuevoProm };
}

/**
 * Revierte una entrada previa (anulación de Entrada de Mercadería): quita la cantidad y
 * descuenta el valor original de la capa, recalculando el promedio del saldo restante.
 */
export async function aplicarReversaEntrada(
  tx: Tx,
  empresaId: string,
  movimientoOrigenId: string,
  fecha: string,
) {
  const [mov] = await tx
    .select()
    .from(stockMovimientos)
    .where(and(eq(stockMovimientos.id, movimientoOrigenId), eq(stockMovimientos.empresaId, empresaId)));
  if (!mov) throw new Error("El movimiento de stock a revertir no existe");
  if (mov.tipo !== "entrada") throw new Error("Solo se revierten movimientos de entrada");

  const [saldo] = await tx
    .select()
    .from(productoStock)
    .where(
      and(
        eq(productoStock.empresaId, empresaId),
        eq(productoStock.productoId, mov.productoId),
      ),
    )
    .for("update");

  const qtyPrev = saldo ? Number(saldo.cantidad) : 0;
  const promPrev = saldo ? Number(saldo.costoPromedio) : 0;
  const cant = Number(mov.cantidad);
  const costoTotal = Number(mov.costoTotal);
  const nuevaQty = redondear(qtyPrev - cant, 6);
  const valor = qtyPrev * promPrev - costoTotal;
  const nuevoProm = nuevaQty > 0 ? redondear(Math.max(valor, 0) / nuevaQty) : 0;

  if (saldo) {
    await tx
      .update(productoStock)
      .set({
        cantidad: (nuevaQty < 0 ? 0 : nuevaQty).toString(),
        costoPromedio: nuevoProm.toString(),
        updatedAt: new Date(),
      })
      .where(eq(productoStock.id, saldo.id));
  }

  await tx.insert(stockMovimientos).values({
    empresaId,
    productoId: mov.productoId,
    fecha,
    tipo: "salida",
    cantidad: cant.toString(),
    costoUnitario: mov.costoUnitario,
    costoTotal: costoTotal.toString(),
    saldoCantidad: (nuevaQty < 0 ? 0 : nuevaQty).toString(),
    saldoCostoPromedio: nuevoProm.toString(),
    origenTabla: mov.origenTabla,
    origenId: mov.origenId,
    glosa: `Reversa de entrada — ${mov.glosa ?? ""}`.trim(),
  });

  return { saldoCantidad: nuevaQty, saldoCostoPromedio: nuevoProm };
}

/**
 * Salida de stock al costo promedio vigente (venta de inventario). El promedio no cambia.
 * Debe llamarse dentro de una transacción.
 */
export async function aplicarSalidaStock(
  tx: Tx,
  empresaId: string,
  productoId: string,
  salida: { cantidad: number } & OrigenMov,
) {
  const [saldo] = await tx
    .select()
    .from(productoStock)
    .where(and(eq(productoStock.empresaId, empresaId), eq(productoStock.productoId, productoId)))
    .for("update");

  const qtyPrev = saldo ? Number(saldo.cantidad) : 0;
  const prom = saldo ? Number(saldo.costoPromedio) : 0;
  if (salida.cantidad > qtyPrev + 0.000001) {
    const [prod] = await tx
      .select({ codigo: productos.codigo })
      .from(productos)
      .where(eq(productos.id, productoId));
    throw new Error(
      `No hay stock suficiente de ${prod?.codigo ?? productoId} (disponible ${qtyPrev}, se necesitan ${salida.cantidad}).`,
    );
  }

  const costoUnitario = prom;
  const costoTotal = redondear(salida.cantidad * costoUnitario);
  const nuevaQty = redondear(qtyPrev - salida.cantidad, 6);

  if (saldo) {
    await tx
      .update(productoStock)
      .set({ cantidad: nuevaQty.toString(), updatedAt: new Date() })
      .where(eq(productoStock.id, saldo.id));
  } else {
    await tx
      .insert(productoStock)
      .values({ empresaId, productoId, cantidad: nuevaQty.toString(), costoPromedio: "0" });
  }

  await tx.insert(stockMovimientos).values({
    empresaId,
    productoId,
    fecha: salida.fecha,
    tipo: "salida",
    cantidad: salida.cantidad.toString(),
    costoUnitario: costoUnitario.toString(),
    costoTotal: costoTotal.toString(),
    saldoCantidad: nuevaQty.toString(),
    saldoCostoPromedio: prom.toString(),
    origenTabla: salida.origenTabla ?? null,
    origenId: salida.origenId ?? null,
    asientoId: salida.asientoId ?? null,
    glosa: salida.glosa ?? null,
  });

  return { costoUnitario, costoTotal, saldoCantidad: nuevaQty };
}

/**
 * Revierte una salida previa (anulación de una venta de inventario): repone la cantidad
 * a su costo original y recalcula el promedio.
 */
export async function aplicarReversaSalida(
  tx: Tx,
  empresaId: string,
  movimientoOrigenId: string,
  fecha: string,
) {
  const [mov] = await tx
    .select()
    .from(stockMovimientos)
    .where(and(eq(stockMovimientos.id, movimientoOrigenId), eq(stockMovimientos.empresaId, empresaId)));
  if (!mov) throw new Error("El movimiento de stock a revertir no existe");
  if (mov.tipo !== "salida") throw new Error("Solo se revierten movimientos de salida");

  const [saldo] = await tx
    .select()
    .from(productoStock)
    .where(and(eq(productoStock.empresaId, empresaId), eq(productoStock.productoId, mov.productoId)))
    .for("update");

  const qtyPrev = saldo ? Number(saldo.cantidad) : 0;
  const promPrev = saldo ? Number(saldo.costoPromedio) : 0;
  const cant = Number(mov.cantidad);
  const costoTotal = Number(mov.costoTotal);
  const nuevaQty = redondear(qtyPrev + cant, 6);
  const nuevoProm =
    nuevaQty > 0 ? redondear((qtyPrev * promPrev + costoTotal) / nuevaQty) : 0;

  if (saldo) {
    await tx
      .update(productoStock)
      .set({ cantidad: nuevaQty.toString(), costoPromedio: nuevoProm.toString(), updatedAt: new Date() })
      .where(eq(productoStock.id, saldo.id));
  } else {
    await tx
      .insert(productoStock)
      .values({ empresaId, productoId: mov.productoId, cantidad: nuevaQty.toString(), costoPromedio: nuevoProm.toString() });
  }

  await tx.insert(stockMovimientos).values({
    empresaId,
    productoId: mov.productoId,
    fecha,
    tipo: "entrada",
    cantidad: cant.toString(),
    costoUnitario: mov.costoUnitario,
    costoTotal: costoTotal.toString(),
    saldoCantidad: nuevaQty.toString(),
    saldoCostoPromedio: nuevoProm.toString(),
    origenTabla: mov.origenTabla,
    origenId: mov.origenId,
    glosa: `Reversa de salida — ${mov.glosa ?? ""}`.trim(),
  });

  return { saldoCantidad: nuevaQty, saldoCostoPromedio: nuevoProm };
}

/** Movimientos de un producto, más recientes primero. */
export async function listarKardex(empresaId: string, productoId: string) {
  return db
    .select()
    .from(stockMovimientos)
    .where(
      and(
        eq(stockMovimientos.empresaId, empresaId),
        eq(stockMovimientos.productoId, productoId),
      ),
    )
    .orderBy(desc(stockMovimientos.fecha), desc(stockMovimientos.createdAt));
}

/** Saldos de inventario de la empresa (solo productos con fila de stock). */
export async function listarStockDeEmpresa(empresaId: string) {
  return db
    .select({
      productoId: productoStock.productoId,
      codigo: productos.codigo,
      nombre: productos.nombre,
      grupoId: productos.grupoId,
      grupoNombre: productosGrupos.nombre,
      cantidad: productoStock.cantidad,
      costoPromedio: productoStock.costoPromedio,
      valor: sql<string>`(${productoStock.cantidad} * ${productoStock.costoPromedio})`,
    })
    .from(productoStock)
    .innerJoin(productos, eq(productoStock.productoId, productos.id))
    .innerJoin(productosGrupos, eq(productos.grupoId, productosGrupos.id))
    .where(eq(productoStock.empresaId, empresaId))
    .orderBy(asc(productos.codigo));
}
