import { notFound } from "next/navigation";
import { empresaTieneAsientos, obtenerEmpresa } from "@erp/db";
import { VisualizacionForm } from "@/components/panel/visualizacion-form";
import { Card, CardContent } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function VisualizacionPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [empresa, tieneAsientos] = await Promise.all([
    obtenerEmpresa(empresaId),
    empresaTieneAsientos(empresaId),
  ]);
  if (!empresa) notFound();

  return (
    <>
      <TypographyHeading
        title="Visualización"
        description="Cómo se muestran los números en esta empresa: separadores y decimales (equivalente a la pestaña de Configuración general de SAP B1)."
      />
      <Card>
        <CardContent>
          <VisualizacionForm
            empresaId={empresaId}
            decimalesBloqueados={tieneAsientos}
            valoresIniciales={{
              separadorDecimal: empresa.separadorDecimal === "." ? "." : ",",
              separadorMiles: empresa.separadorMiles as "" | " " | "." | ",",
              decimalesTipoCambio: empresa.decimalesTipoCambio,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
