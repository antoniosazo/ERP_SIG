/** Datos de una factura (o nota) listos para mostrar y para el PDF, sin importar de dónde vengan. */
export type FacturaDatos = {
  /** Ej. "Factura electrónica", "Nota de crédito". */
  titulo: string;
  folio: string;
  fechaEmision: string;
  emisor: { razonSocial: string; rut: string };
  receptor: { razonSocial: string; rut: string };
  lineas: {
    nombre: string;
    descripcion?: string;
    cantidad?: number;
    precioUnitario?: number;
    montoItem: number;
    exento: boolean;
  }[];
  referencias: { tipoDocRef: string; folioRef: string; fechaRef?: string; razonRef?: string }[];
  montoNeto: number;
  montoExento: number;
  montoIva: number;
  montoTotal: number;
  /** Datos adicionales de cabecera (N° interno, vencimiento, estado…). */
  extras?: { etiqueta: string; valor: string }[];
  /** Pie de página del PDF. */
  pie?: string;
  /** Aviso a mostrar (ej. error de carga). */
  aviso?: string | null;
};

export const NOMBRE_DTE: Record<number, string> = {
  33: "Factura electrónica",
  34: "Factura exenta electrónica",
  46: "Factura de compra electrónica",
  56: "Nota de débito electrónica",
  61: "Nota de crédito electrónica",
};
