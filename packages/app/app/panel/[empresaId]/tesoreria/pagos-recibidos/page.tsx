import { PagosListaPage } from "@/components/panel/pagos-pages";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = await params;
  return <PagosListaPage empresaId={empresaId} tipo="Recibido" />;
}
