import { PagoDetallePage } from "@/components/panel/pagos-pages";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ empresaId: string; pagoId: string }> }) {
  const { empresaId, pagoId } = await params;
  return <PagoDetallePage empresaId={empresaId} tipo="Efectuado" pagoId={pagoId} />;
}
