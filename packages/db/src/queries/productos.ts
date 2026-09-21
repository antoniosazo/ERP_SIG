import type { CrearProductoInput, EditarProductoInput } from "@erp/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { productos, productosGrupos } from "../schema";
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

/** Valida que el grupo sea de la empresa (la imputación contable ya no vive en el producto). */
async function validarRefs(tx: Tx, empresaId: string, input: CrearProductoInput | EditarProductoInput) {
  const [grupo] = await tx
    .select({ id: productosGrupos.id })
    .from(productosGrupos)
    .where(and(eq(productosGrupos.id, input.grupoId), eq(productosGrupos.empresaId, empresaId)));
  if (!grupo) throw new Error("El grupo de productos no existe en esta empresa");
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
 * Productos activos con la imputación contable de su grupo, para el selector de línea
 * del formulario de documento. La imputación ya no se puede sobrescribir por producto:
 * siempre sale del grupo (ver nota en el schema de `productos`).
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
      cuentaIngresoId: productosGrupos.cuentaIngresoDefaultId,
      impuestoId: productosGrupos.impuestoDefaultId,
      centroCostoId: productosGrupos.centroCostoDefaultId,
      categoriaContableId: productosGrupos.categoriaContableDefaultId,
      cuentaInventarioId: productosGrupos.cuentaInventarioDefaultId,
      cuentaCostoVentaId: productosGrupos.cuentaCostoVentaDefaultId,
    })
    .from(productos)
    .innerJoin(productosGrupos, eq(productos.grupoId, productosGrupos.id))
    .where(
      and(
        eq(productos.empresaId, empresaId),
        eq(productos.estado, "Activo"),
        eq(productos.esVenta, true),
      ),
    )
    .orderBy(asc(productos.codigo));

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    precioUnitario: Number(r.precioUnitario),
    glosaSugerida: r.glosaSugerida,
    esInventario: r.esInventario,
    cuentaIngresoId: r.cuentaIngresoId,
    impuestoId: r.impuestoId,
    centroCostoId: r.centroCostoId,
    categoriaContableId: r.categoriaContableId,
    cuentaInventarioId: r.cuentaInventarioId,
    cuentaCostoVentaId: r.cuentaCostoVentaId,
  }));
}

/**
 * Productos comprables con la imputación de compra de su grupo, para el selector de
 * línea del formulario de documento de compra. Igual que en venta, ya no hay override
 * por producto.
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
      gGasto: productosGrupos.cuentaGastoCompraDefaultId,
      gInventario: productosGrupos.cuentaInventarioDefaultId,
      gImpuesto: productosGrupos.impuestoCompraDefaultId,
      gCentro: productosGrupos.centroCostoDefaultId,
      gCategoria: productosGrupos.categoriaContableDefaultId,
    })
    .from(productos)
    .innerJoin(productosGrupos, eq(productos.grupoId, productosGrupos.id))
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
      cuentaImputacionId: r.esInventario ? r.gInventario : r.gGasto,
      impuestoId: r.gImpuesto,
      centroCostoId: r.gCentro,
      categoriaContableId: r.gCategoria,
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

/** Código y nombre de los productos indicados (para mostrar líneas de un documento). */
export async function productosPorIds(empresaId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, { codigo: string; nombre: string; tipo: string }>();
  const rows = await db
    .select({ id: productos.id, codigo: productos.codigo, nombre: productos.nombre, tipo: productos.tipo })
    .from(productos)
    .where(and(eq(productos.empresaId, empresaId), inArray(productos.id, ids)));
  return new Map(rows.map((r) => [r.id, { codigo: r.codigo, nombre: r.nombre, tipo: r.tipo as string }]));
}
