import type { ConfigFormularioDoc } from "@erp/shared";

/** Clave de `preferencias_formulario` para el formulario de documentos de venta. */
export const CLAVE_FORM_DOC_VENTA = "documento_venta";

export type CampoDef = { id: string; label: string; estructural?: boolean };
export type SeccionConfig = { orden: string[]; ocultos: string[] };
export type CampoResuelto = { id: string; label: string; visible: boolean; estructural: boolean };

/** Campos de cabecera. Los `estructural` no se pueden ocultar (pero sí reordenar). */
export const CAMPOS_CABECERA: CampoDef[] = [
  { id: "terceroId", label: "Cliente", estructural: true },
  { id: "tipoDocumentoId", label: "Tipo de documento", estructural: true },
  { id: "modalidad", label: "Tipo (Artículo / Servicio)", estructural: true },
  { id: "fechaEmision", label: "Fecha del documento", estructural: true },
  { id: "fechaVencimiento", label: "Fecha de vencimiento", estructural: true },
  { id: "fechaContabilizacion", label: "Fecha de contabilización", estructural: true },
  { id: "monedaId", label: "Moneda", estructural: true },
  { id: "folio", label: "Folio SII" },
  { id: "numAtCard", label: "N° ref. del cliente" },
  { id: "tipoCambio", label: "Tipo de cambio" },
  { id: "descuentoGlobalPct", label: "Descuento global %" },
  { id: "documentoReferenciaId", label: "Documento que corrige" },
  { id: "nombreCliente", label: "Nombre del cliente" },
  { id: "condicionPagoDias", label: "Condición de pago (días)" },
  { id: "vendedorId", label: "Vendedor" },
  { id: "contactoId", label: "Persona de contacto" },
  { id: "direccionFacturacion", label: "Dirección de facturación" },
  { id: "direccionDespacho", label: "Dirección de despacho" },
  { id: "glosa", label: "Glosa" },
];

/** Columnas de la grilla de líneas. */
export const CAMPOS_LINEA: CampoDef[] = [
  { id: "productoId", label: "Producto" },
  { id: "cuentaIngresoId", label: "Cuenta de ingreso", estructural: true },
  { id: "cantidad", label: "Cantidad", estructural: true },
  { id: "precioUnitario", label: "Precio unitario", estructural: true },
  { id: "descuentoLineaPct", label: "Descuento %" },
  { id: "impuestoId", label: "Impuesto" },
  { id: "esExento", label: "Exento" },
  { id: "glosa", label: "Glosa" },
  { id: "categoriaContableId", label: "Categoría contable" },
  { id: "centroCostoId", label: "Centro de costo" },
  { id: "fechaDiferimiento", label: "Fecha de diferimiento" },
  { id: "nombreCuenta", label: "Nombre de la cuenta" },
  { id: "totalConIva", label: "Total con IVA" },
];

export const CONFIG_VACIA: ConfigFormularioDoc = {
  cabecera: { orden: [], ocultos: [] },
  linea: { orden: [], ocultos: [] },
};

/**
 * Aplica la config de un usuario a un registro de campos: devuelve los campos en el
 * orden efectivo (los del `orden` primero, luego los no listados en su orden original)
 * con su visibilidad (los `estructural` siempre visibles).
 */
export function aplicarConfig(campos: CampoDef[], seccion?: SeccionConfig): CampoResuelto[] {
  const orden = seccion?.orden ?? [];
  const ocultos = new Set(seccion?.ocultos ?? []);
  const restantes = new Map(campos.map((c) => [c.id, c]));
  const ordenados: CampoDef[] = [];
  for (const id of orden) {
    const c = restantes.get(id);
    if (c) {
      ordenados.push(c);
      restantes.delete(id);
    }
  }
  for (const c of campos) if (restantes.has(c.id)) ordenados.push(c);
  return ordenados.map((c) => ({
    id: c.id,
    label: c.label,
    estructural: !!c.estructural,
    visible: c.estructural ? true : !ocultos.has(c.id),
  }));
}
