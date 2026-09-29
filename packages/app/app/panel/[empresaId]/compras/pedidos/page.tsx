import { ComprasListaPage } from "@/components/panel/compras-lista-page";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ estado?: string; q?: string; desde?: string; hasta?: string; terceroId?: string; pagina?: string }>;
}) {
  const [{ empresaId }, filtros] = await Promise.all([params, searchParams]);
  return <ComprasListaPage empresaId={empresaId} docTipo="pedido" filtros={filtros} />;
}
