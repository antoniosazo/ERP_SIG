import type { CrearProductoInput, EditarProductoInput } from "@erp/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import {
  categoriasContables,
  centrosCosto,
  impuestos,
  planCuentas,
  productos,
  productosGrupos,
} from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { sembrarSeriesProducto, siguienteCodigo } from "./series";

const etiqueta = (p: { codigo: string; nombre: string }) => `${p.codigo} — ${p.nombre}`;

export async function listarProductos(
  empresaId: string,
  f: { estado?: string; grupoId?: string; tipo?: string } = {},
) {
  const cond = [eq(productos.empresaId, empresaId)];
  if (f.estado) cond.push(eq(productos.estado, f.estado));
  if (f.grupoId) cond.push(eq(productos.grupoId, f.grupoId));
  if (f.tipo) cond.push(eq(productos.tipo, f.tipo as never));
  return db
    .select()
    .from(productos)
    .where(and(...cond))
    .orderBy(asc(productos.codigo));
}

/** Valida que el grupo y las referencias contables opcionales sean de la empresa. */
async function validarRefs(tx: Tx, empresaId: string, input: CrearProductoInput | EditarProductoInput) {
  const [grupo] = await tx
    .select({ id: productosGrupos.id })
    .from(productosGrupos)
    .where(and(eq(productosGrupos.id, input.grupoId), eq(productosGrupos.empresaId, empresaId)));
  if (!grupo) throw new Error("El grupo de productos no existe en esta empresa");

  const chequear = async (
    id: string | null | undefined,
    tabla: typeof planCuentas | typeof impuestos | typeof centrosCosto | typeof categoriasContables,
    msg: string,
  ) => {
    if (!id) return;
    const [row] = await tx
      .select({ id: tabla.id })
      .from(tabla)
      .where(and(eq(tabla.id, id), eq(tabla.empresaId, empresaId)));
    if (!row) throw new Error(msg);
  };
  await chequear(input.cuentaIngresoId, planCuentas, "La cuenta de ingreso no es de esta empresa");
  await chequear(input.impuestoId, impuestos, "El impuesto no es de esta empresa");
  await chequear(input.centroCostoId, centrosCosto, "El centro de costo no es de esta empresa");
  await chequear(
    input.categoriaContableId,
    categoriasContables,
    "La categoría contable no es de esta empresa",
  );
  await chequear(input.cuentaInventarioId, planCuentas, "La cuenta de inventario no es de esta empresa");
  await chequear(
    input.cuentaCostoVentaId,
    planCuentas,
    "La cuenta de costo de venta no es de esta empresa",
  );
  await chequear(
    input.cuentaGastoCompraId,
    planCuentas,
    "La cuenta de gasto de compra no es de esta empresa",
  );
  await chequear(input.impuestoCompraId, impuestos, "El impuesto de compra no es de esta empresa");
}

/** Campos comunes de INSERT/UPDATE (el `codigo` se maneja aparte en cada función). */
function valores(input: CrearProductoInput | EditarProductoInput) {
  // Regla de negocio: un "Servicio" nunca controla inventario.
  const esInventario = input.tipo === "Servicio" ? false : input.esInventario;
  return {
    grupoId: input.grupoId,
    nombre: input.nombre,
    tipo: input.tipo,
    estado: input.estado,
    precioUnitario: input.precioUnitario.toString(),
    unidadMedida: input.unidadMedida || null,
    codigoBarras: input.codigoBarras || null,
    glosaSugerida: input.glosaSugerida || null,
    esVenta: input.esVenta,
    esCompra: input.esCompra,
    esInventario,
    metodoValoracion: input.metodoValoracion,
    costoEstandar: input.costoEstandar.toString(),
    cuentaIngresoId: input.cuentaIngresoId ?? null,
    impuestoId: input.impuestoId ?? null,
    centroCostoId: input.centroCostoId ?? null,
    categoriaContableId: input.categoriaContableId ?? null,
    cuentaInventarioId: input.cuentaInventarioId ?? null,
    cuentaCostoVentaId: input.cuentaCostoVentaId ?? null,
    cuentaGastoCompraId: input.cuentaGastoCompraId ?? null,
    impuestoCompraId: input.impuestoCompraId ?? null,
  };
}

export async function crearProducto(
  empresaId: string,
  input: CrearProductoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    await validarRefs(tx, empresaId, input);
    // El código se asigna automáticamente y es inmutable.
    await sembrarSeriesProducto(tx, empresaId);
    const codigo = await siguienteCodigo(tx, empresaId, "producto", "codigo");
    const [prod] = await tx
      .insert(productos)
      .values({ empresaId, codigo, ...valores(input) })
      .returning();
    if (!prod) throw new Error("No se pudo crear el producto");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "productos",
        registroId: prod.id,
        etiqueta: etiqueta(prod),
        accion: "crear",
        despues: prod,
      });
    }
    return prod;
  });
}

export async function actualizarProducto(
  productoId: string,
  empresaId: string,
  input: EditarProductoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(productos)
      .where(and(eq(productos.id, productoId), eq(productos.empresaId, empresaId)));
    if (!antes) throw new Error("El producto no existe en esta empresa");
    await validarRefs(tx, empresaId, input);

    const [prod] = await tx
      .update(productos)
      .set({ ...valores(input), codigo: antes.codigo, updatedAt: new Date() })
      .where(and(eq(productos.id, productoId), eq(productos.empresaId, empresaId)))
      .returning();
    if (!prod) throw new Error("No se pudo actualizar el producto");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "productos",
        registroId: prod.id,
        etiqueta: etiqueta(prod),
        accion: "editar",
        antes,
        despues: prod,
      });
    }
    return prod;
  });
}

/**
 * Productos activos con sus valores efectivos (producto ?? grupo), para el selector de
 * línea del formulario de documento.
 */
export async function listarProductosParaDocumento(empresaId: string) {
  const rows = await db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      nombre: productos.nombre,
      precioUnitario: productos.precioUnitario,
      glosaSugerida: productos.glosaSugerida,
      esInventario: productos.esInventario,
      pCuenta: productos.cuentaIngresoId,
      pImpuesto: productos.impuestoId,
      pCentro: productos.centroCostoId,
      pCategoria: productos.categoriaContableId,
      pInventario: productos.cuentaInventarioId,
      pCostoVenta: productos.cuentaCostoVentaId,
      gCuenta: productosGrupos.cuentaIngresoDefaultId,
      gImpuesto: productosGrupos.impuestoDefaultId,
      gCentro: productosGrupos.centroCostoDefaultId,
      gCategoria: productosGrupos.categoriaContableDefaultId,
      gInventario: productosGrupos.cuentaInventarioDefaultId,
      gCostoVenta: productosGrupos.cuentaCostoVentaDefaultId,
    })
    .from(productos)
    .leftJoin(productosGrupos, eq(productos.grupoId, productosGrupos.id))
    .where(and(eq(productos.empresaId, empresaId), eq(productos.estado, "Activo")))
    .orderBy(asc(productos.codigo));

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    precioUnitario: Number(r.precioUnitario),
    glosaSugerida: r.glosaSugerida,
    esInventario: r.esInventario,
    cuentaIngresoId: r.pCuenta ?? r.gCuenta ?? null,
    impuestoId: r.pImpuesto ?? r.gImpuesto ?? null,
    centroCostoId: r.pCentro ?? r.gCentro ?? null,
    categoriaContableId: r.pCategoria ?? r.gCategoria ?? null,
    cuentaInventarioId: r.pInventario ?? r.gInventario ?? null,
    cuentaCostoVentaId: r.pCostoVenta ?? r.gCostoVenta ?? null,
  }));
}

/**
 * Productos comprables con sus valores efectivos de compra (producto ?? grupo), para el
 * selector de línea del formulario de documento de compra.
 */
export async function listarProductosParaCompra(empresaId: string) {
  const rows = await db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      nombre: productos.nombre,
      costoEstandar: productos.costoEstandar,
      precioUnitario: productos.precioUnitario,
      glosaSugerida: productos.glosaSugerida,
      esInventario: productos.esInventario,
      pGasto: productos.cuentaGastoCompraId,
      pInventario: productos.cuentaInventarioId,
      pImpuesto: productos.impuestoCompraId,
      pCentro: productos.centroCostoId,
      pCategoria: productos.categoriaContableId,
      gGasto: productosGrupos.cuentaGastoCompraDefaultId,
      gInventario: productosGrupos.cuentaInventarioDefaultId,
      gImpuesto: productosGrupos.impuestoCompraDefaultId,
      gCentro: productosGrupos.centroCostoDefaultId,
      gCategoria: productosGrupos.categoriaContableDefaultId,
    })
    .from(productos)
    .leftJoin(productosGrupos, eq(productos.grupoId, productosGrupos.id))
    .where(
      and(
        eq(productos.empresaId, empresaId),
        eq(productos.estado, "Activo"),
        eq(productos.esCompra, true),
      ),
    )
    .orderBy(asc(productos.codigo));

  return rows.map((r) => {
    const costo = Number(r.costoEstandar) || Number(r.precioUnitario);
    return {
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      precioUnitario: costo,
      glosaSugerida: r.glosaSugerida,
      esInventario: r.esInventario,
      // En la Fase A las líneas de inventario se rechazan; igual dejamos la cuenta resuelta.
      cuentaImputacionId: r.esInventario
        ? (r.pInventario ?? r.gInventario ?? null)
        : (r.pGasto ?? r.gGasto ?? null),
      impuestoId: r.pImpuesto ?? r.gImpuesto ?? null,
      centroCostoId: r.pCentro ?? r.gCentro ?? null,
      categoriaContableId: r.pCategoria ?? r.gCategoria ?? null,
    };
  });
}

/** ¿La empresa tiene al menos un grupo de productos? (para el aviso del maestro). */
export async function empresaTieneGruposProducto(empresaId: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`1` })
    .from(productosGrupos)
    .where(eq(productosGrupos.empresaId, empresaId))
    .limit(1);
  return row !== undefined;
}
