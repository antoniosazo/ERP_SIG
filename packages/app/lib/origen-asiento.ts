/** Pantalla del documento que originó un asiento (si existe), para enlazar desde mayores y cuentas corrientes. */
export function rutaOrigen(
  empresaId: string,
  m: { origenTabla: string | null; origenId: string | null; pagoTipo: string | null },
): string | null {
  if (!m.origenTabla || !m.origenId) return null;
  const base = `/panel/${empresaId}`;
  switch (m.origenTabla) {
    case "documentos_compra":
      return `${base}/compras/documentos/${m.origenId}`;
    case "documentos_venta":
      return `${base}/ventas/documentos/${m.origenId}`;
    case "pagos":
      return m.pagoTipo
        ? `${base}/tesoreria/${m.pagoTipo === "Recibido" ? "pagos-recibidos" : "pagos-efectuados"}/${m.origenId}`
        : null;
    case "depositos":
      return `${base}/tesoreria/depositos/${m.origenId}`;
    case "cheques":
      return `${base}/tesoreria/cheques?estado=todos`;
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
};
