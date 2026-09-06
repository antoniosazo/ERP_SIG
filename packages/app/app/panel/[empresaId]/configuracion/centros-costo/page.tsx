import { listarCentrosCosto } from "@erp/db";
import { CentrosCostoManager } from "@/components/panel/centros-costo-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function CentrosCostoPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const centros = await listarCentrosCosto(empresaId);

  return (
    <>
      <TypographyHeading
        title="Centros de costo"
        description="Dimensión de análisis para clasificar los movimientos además de la cuenta contable (3.3)."
      />
      <CentrosCostoManager
        empresaId={empresaId}
        centros={centros.map((c) => ({
          id: c.id,
          codigo: c.codigo,
          nombre: c.nombre,
          estado: c.estado,
          centroPadreId: c.centroPadreId,
        }))}
      />
    </>
  );
}
