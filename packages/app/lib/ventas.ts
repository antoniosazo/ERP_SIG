import type { DocumentoVentaClase } from "@erp/shared";

/** Mapea la clase de documento de venta a su segmento de ruta y etiquetas de UI. */
export const VENTA_CLASE_META: Record<
  DocumentoVentaClase,
  { slug: string; titulo: string; singular: string }
> = {
  Factura: { slug: "facturas", titulo: "Facturas de venta", singular: "factura" },
  "Nota de Crédito": {
    slug: "notas-credito",
    titulo: "Notas de crédito",
    singular: "nota de crédito",
  },
  "Nota de Débito": {
    slug: "notas-debito",
    titulo: "Notas de débito",
    singular: "nota de débito",
  },
};

export function claseDeSlug(slug: string): DocumentoVentaClase | null {
  const entry = Object.entries(VENTA_CLASE_META).find(([, m]) => m.slug === slug);
  return (entry?.[0] as DocumentoVentaClase) ?? null;
}
