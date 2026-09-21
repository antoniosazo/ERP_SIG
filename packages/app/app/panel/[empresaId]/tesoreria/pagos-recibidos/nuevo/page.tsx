import { PagoNuevoPage } from "@/components/panel/pagos-pages";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ empresaId: string }> }) {
  const { empresaId } = await params;
  return <PagoNuevoPage empresaId={empresaId} tipo="Recibido" />;
}
