/**
 * Pantalla del documento que originó un asiento, para enlazar desde mayores y cuentas
 * corrientes. Los asientos manuales (y sus reversas) no tienen documento: se enlaza su ficha.
 */
export function rutaOrigen(
  empresaId: string,
  m: { origenTabla: string | null; origenId: string | null; pagoTipo: string | null; asientoId?: string; anio?: number },
): string | null {
  const base = `/panel/${empresaId}`;
  if ((!m.origenTabla || m.origenTabla === "asientos_contables") && m.asientoId) {
    return `${base}/contabilidad/asientos/${m.asientoId}`;
  }
  if (!m.origenTabla || !m.origenId) return null;
  switch (m.origenTabla) {
    case "documentos_compra":
      return `${base}/compras/documentos/${m.origenId}`;
    case "documentos_venta":
      return `${base}/ventas/documentos/${m.origenId}`;
    case "pagos":
      return (m.pagoTipo === "Recibido" || m.pagoTipo === "Efectuado")
        ? `${base}/tesoreria/${m.pagoTipo === "Recibido" ? "pagos-recibidos" : "pagos-efectuados"}/${m.origenId}`
        : null;
    case "depositos":
      return `${base}/tesoreria/depositos/${m.origenId}`;
    case "cheques":
      return `${base}/tesoreria/cheques/${m.origenId}`;
    case "activos_fijos_documentos":
      return `${base}/activos-fijos/documentos/${m.origenId}`;
    case "cierres_ejercicio":
      return m.anio ? `${base}/configuracion/cierre-ejercicio?anio=${m.anio}` : null;
    case "asientos_contables":
      return `${base}/contabilidad/asientos/${m.origenId}`;
    default:
      return null;
  }
}

export const ETIQUETA_ORIGEN: Record<string, string> = {
  documentos_compra: "Compra",
  documentos_venta: "Venta",
  pagos: "Pago",
  depositos: "Depósito",
  cheques: "Cheque",
  asientos_contables: "Reversa",
  activos_fijos_documentos: "Activo fijo",
  cierres_ejercicio: "Cierre de ejercicio",
};
