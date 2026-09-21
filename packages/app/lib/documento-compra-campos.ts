import type { CampoDef } from "@/lib/documento-venta-campos";

export { aplicarConfig } from "@/lib/documento-venta-campos";
export type {
  CampoDef,
  CampoResuelto,
  SeccionConfig,
} from "@/lib/documento-venta-campos";

/** Clave de `preferencias_formulario` para el formulario de documentos de compra. */
export const CLAVE_FORM_DOC_COMPRA = "documento_compra";

/** Campos de cabecera. Los `estructural` no se pueden ocultar (pero sí reordenar). */
export const CAMPOS_CABECERA: CampoDef[] = [
  { id: "terceroId", label: "Proveedor", estructural: true },
  { id: "tipoDocumentoId", label: "Tipo de documento", estructural: true },
  { id: "modalidad", label: "Tipo (Artículo / Servicio)", estructural: true },
  { id: "fechaEmision", label: "Fecha del documento", estructural: true },
  { id: "fechaVencimiento", label: "Fecha de vencimiento", estructural: true },
  { id: "fechaContabilizacion", label: "Fecha de contabilización", estructural: true },
  { id: "monedaId", label: "Moneda", estructural: true },
  { id: "folio", label: "Folio SII" },
  { id: "numAtCard", label: "N° del documento del proveedor" },
  { id: "tipoCambio", label: "Tipo de cambio" },
  { id: "descuentoGlobalPct", label: "Descuento global %" },
  { id: "condicionPagoDias", label: "Condición de pago (días)" },
  { id: "glosa", label: "Glosa" },
];

/** Columnas de la grilla de líneas. */
export const CAMPOS_LINEA: CampoDef[] = [
  { id: "productoId", label: "Artículo" },
  { id: "cuentaImputacionId", label: "Cuenta de imputación", estructural: true },
  { id: "cantidad", label: "Cantidad", estructural: true },
  { id: "precioUnitario", label: "Precio unitario", estructural: true },
  { id: "descuentoLineaPct", label: "Descuento %" },
  { id: "impuestoId", label: "Impuesto" },
  { id: "esExento", label: "Exento" },
  { id: "ivaRecuperable", label: "IVA recuperable" },
  { id: "glosa", label: "Glosa" },
  { id: "categoriaContableId", label: "Categoría contable" },
  { id: "centroCostoId", label: "Centro de costo" },
  { id: "cantidadPendiente", label: "Pendiente" },
  { id: "totalConIva", label: "Total con IVA" },
];
