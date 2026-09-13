import { ImportarRcv } from "@/components/panel/importar-rcv";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function ImportarSiiVentasPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  return (
    <>
      <TypographyHeading
        title="Importar Ventas del SII"
        description="Trae el Registro de Ventas de un período tributario y crea los documentos en borrador."
      />
      <ImportarRcv empresaId={empresaId} origen="venta" />
    </>
  );
}
