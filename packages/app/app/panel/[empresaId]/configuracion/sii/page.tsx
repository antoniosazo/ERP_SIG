import { obtenerEstadoSiiAction } from "@/lib/actions/sii";
import { SiiCredencialesForm } from "@/components/panel/sii-credenciales-form";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function ConexionSiiPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const estado = await obtenerEstadoSiiAction(empresaId);

  return (
    <>
      <TypographyHeading
        title="Conexión SII"
        description="Credenciales para descargar el RCV (Clave Tributaria) y hacer el acuse de recibo (Certificado Digital). Se guardan cifradas."
      />
      <SiiCredencialesForm empresaId={empresaId} estado={estado} />
    </>
  );
}
