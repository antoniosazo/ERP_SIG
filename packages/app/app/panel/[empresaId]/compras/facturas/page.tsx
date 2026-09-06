import { ComprasListaPage } from "@/components/panel/compras-lista-page";

export const dynamic = "force-dynamic";

export default async function FacturasCompraPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { empresaId } = await params;
  const { estado } = await searchParams;
  return <ComprasListaPage empresaId={empresaId} docTipo="factura" estado={estado} />;
}
