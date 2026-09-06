import type { DocumentoCompraTipo } from "@erp/shared";

/** Mapea el tipo de documento de compra a su segmento de ruta y etiquetas de UI. */
export const COMPRA_TIPO_META: Record<
  DocumentoCompraTipo,
  { slug: string; titulo: string; singular: string; contabiliza: boolean }
> = {
  pedido: { slug: "pedidos", titulo: "Pedidos de compra", singular: "pedido", contabiliza: false },
  entrada_mercaderia: {
    slug: "entradas",
    titulo: "Entradas de mercadería",
    singular: "entrada de mercadería",
    contabiliza: true,
  },
  factura: {
    slug: "facturas",
    titulo: "Facturas de compra",
    singular: "factura",
    contabiliza: true,
  },
  nota_credito: {
    slug: "notas-credito",
    titulo: "Notas de crédito",
    singular: "nota de crédito",
    contabiliza: true,
  },
  nota_debito: {
    slug: "notas-debito",
    titulo: "Notas de débito",
    singular: "nota de débito",
    contabiliza: true,
  },
};

export function docTipoDeSlug(slug: string): DocumentoCompraTipo | null {
  const entry = Object.entries(COMPRA_TIPO_META).find(([, m]) => m.slug === slug);
  return (entry?.[0] as DocumentoCompraTipo) ?? null;
}
