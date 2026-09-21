import { DepositoDetallePage } from "@/components/panel/cheques-pages";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ empresaId: string; depositoId: string }>;
}) {
  const { empresaId, depositoId } = await params;
  return <DepositoDetallePage empresaId={empresaId} depositoId={depositoId} />;
}
