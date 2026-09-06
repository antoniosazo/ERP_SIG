import { VentasListaPage } from "@/components/panel/ventas-lista-page";

export const dynamic = "force-dynamic";

export default async function NotasCreditoPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { empresaId } = await params;
  const { estado } = await searchParams;
  return <VentasListaPage empresaId={empresaId} clase="Nota de Crédito" estado={estado} />;
}
