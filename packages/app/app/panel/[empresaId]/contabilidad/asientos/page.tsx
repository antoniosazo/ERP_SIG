import { AsientosListaPage, type FiltrosAsientosParams } from "@/components/panel/asientos-pages";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<FiltrosAsientosParams>;
}) {
  const [{ empresaId }, sp] = await Promise.all([params, searchParams]);
  return <AsientosListaPage empresaId={empresaId} sp={sp} />;
}
