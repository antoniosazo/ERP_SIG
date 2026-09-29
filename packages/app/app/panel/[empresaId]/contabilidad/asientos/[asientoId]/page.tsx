import { notFound } from "next/navigation";
import { AsientoDetallePage } from "@/components/panel/asientos-pages";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { searchParams: Promise<{ lista?: string | string[] }>; params: Promise<{ empresaId: string; asientoId: string }> }) {
  const { empresaId, asientoId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asientoId)) notFound();
  return <AsientoDetallePage empresaId={empresaId} asientoId={asientoId} lista={(await searchParams).lista} />;
}
