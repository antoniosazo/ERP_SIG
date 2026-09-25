import { listarVidasUtilesSii } from "@erp/db";
import { VidasUtilesSiiManager } from "@/components/panel/vidas-utiles-sii-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function VidasUtilesSiiPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const filas = await listarVidasUtilesSii(empresaId);

  return (
    <>
      <TypographyHeading
        title="Vidas útiles SII"
        description="Catálogo de referencia para configurar el régimen Acelerado de un activo (art. 31 N°5 LIR)."
      />
      <VidasUtilesSiiManager empresaId={empresaId} filas={filas} />
    </>
  );
}
