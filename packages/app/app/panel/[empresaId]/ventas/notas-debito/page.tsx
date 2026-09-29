import { VentasListaPage } from "@/components/panel/ventas-lista-page";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{
    estado?: string;
    q?: string;
    desde?: string;
    hasta?: string;
    terceroId?: string;
    pagina?: string;
  }>;
}) {
  const { empresaId } = await params;
  const filtros = await searchParams;
  return <VentasListaPage empresaId={empresaId} clase="Nota de Débito" filtros={filtros} />;
}
