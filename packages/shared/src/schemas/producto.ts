import { z } from "zod";
import { METODO_VALORACION, PRODUCTO_TIPO } from "../enums";
import { uuid } from "./primitives";

/** Grupo de productos: determinación de cuentas por defecto (equivalente a "Item Group"). */
const camposGrupoBase = {
  nombre: z.string().trim().min(1, "Nombre requerido").max(120),
  cuentaIngresoDefaultId: uuid.nullish(),
  impuestoDefaultId: uuid.nullish(),
  centroCostoDefaultId: uuid.nullish(),
  categoriaContableDefaultId: uuid.nullish(),
  cuentaInventarioDefaultId: uuid.nullish(),
  cuentaCostoVentaDefaultId: uuid.nullish(),
  cuentaGastoCompraDefaultId: uuid.nullish(),
  impuestoCompraDefaultId: uuid.nullish(),
  // Resto del catálogo de cuentas de determinación — ver nota en el schema.
  cuentaDotacionDefaultId: uuid.nullish(),
  cuentaDesviacionDefaultId: uuid.nullish(),
  cuentaDiferenciaPrecioDefaultId: uuid.nullish(),
  cuentaAjusteStockNegativoDefaultId: uuid.nullish(),
  cuentaCompensacionStockReduccionDefaultId: uuid.nullish(),
  cuentaCompensacionStockAumentoDefaultId: uuid.nullish(),
  cuentaDevolucionVentaDefaultId: uuid.nullish(),
  cuentaIngresoExtranjeroDefaultId: uuid.nullish(),
  cuentaCostoExtranjeroDefaultId: uuid.nullish(),
  cuentaDiferenciaCambioDefaultId: uuid.nullish(),
  cuentaCompensacionMercaderiaDefaultId: uuid.nullish(),
  cuentaReduccionLibroMayorDefaultId: uuid.nullish(),
  cuentaAumentoLibroMayorDefaultId: uuid.nullish(),
  cuentaStockWipDefaultId: uuid.nullish(),
  cuentaDesviacionStockWipDefaultId: uuid.nullish(),
  cuentaPygCompensacionWipDefaultId: uuid.nullish(),
  cuentaPygCompensacionStockDefaultId: uuid.nullish(),
};
export const crearProductoGrupoSchema = z.object(camposGrupoBase);
export const editarProductoGrupoSchema = z.object(camposGrupoBase);
export type CrearProductoGrupoInput = z.infer<typeof crearProductoGrupoSchema>;
export type EditarProductoGrupoInput = z.infer<typeof editarProductoGrupoSchema>;

/**
 * Producto/servicio del catálogo. Sin inventario: alimenta las líneas de documento.
 * La imputación contable (cuenta de ingreso/inventario/costo de venta/gasto de compra,
 * impuesto, centro de costo, categoría) no vive acá — sale siempre de `grupoId`, para
 * administrarla por grupo y no dispersa producto por producto.
 */
const camposProductoBase = {
  codigo: z.string().trim().max(50).optional(),
  nombre: z.string().trim().min(1, "Nombre requerido").max(200),
  tipo: z.enum(PRODUCTO_TIPO).default("Producto"),
  estado: z.enum(["Activo", "Inactivo"]).default("Activo"),
  grupoId: uuid,
  precioUnitario: z.number().min(0).default(0),
  unidadMedida: z.string().trim().max(10).nullish(),
  codigoBarras: z.string().trim().max(50).nullish(),
  glosaSugerida: z.string().trim().max(300).nullish(),
  esVenta: z.boolean().default(true),
  esCompra: z.boolean().default(false),
  esInventario: z.boolean().default(false),
  metodoValoracion: z.enum(METODO_VALORACION).default("Promedio"),
  costoEstandar: z.number().min(0).default(0),
};
export const crearProductoSchema = z.object(camposProductoBase);
export const editarProductoSchema = z.object(camposProductoBase);
export type CrearProductoInput = z.infer<typeof crearProductoSchema>;
export type EditarProductoInput = z.infer<typeof editarProductoSchema>;
