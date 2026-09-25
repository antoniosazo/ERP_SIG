import { listarFactoresCorreccionMonetaria } from "@erp/db";
import { CorreccionMonetariaManager } from "@/components/panel/correccion-monetaria-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function CorreccionMonetariaPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const factores = await listarFactoresCorreccionMonetaria();

  return (
    <>
      <TypographyHeading
        title="Corrección monetaria"
        description="Reajusta el costo y la depreciación acumulada del libro Tributario según los factores IPC publicados por el SII (art. 41 N°2 LIR)."
      />
      <CorreccionMonetariaManager
        empresaId={empresaId}
        factores={factores.map((f) => ({ id: f.id, anio: f.anio, mes: f.mes, factorPorcentaje: f.factorPorcentaje }))}
      />
    </>
  );
}
