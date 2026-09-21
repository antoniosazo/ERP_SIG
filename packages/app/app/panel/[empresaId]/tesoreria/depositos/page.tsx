import { DepositosPage } from "@/components/panel/cheques-pages";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = await params;
  return <DepositosPage empresaId={empresaId} />;
}
