import { listarPeriodos } from "@erp/db";
import { DepreciacionRunner } from "@/components/panel/depreciacion-runner";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function EjecutarDepreciacionPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const periodos = await listarPeriodos(empresaId);

  return (
    <>
      <TypographyHeading
        title="Ejecutar depreciación"
        description="Simula y contabiliza la depreciación mensual de los activos capitalizados."
      />
      <DepreciacionRunner
        empresaId={empresaId}
        periodos={periodos.map((p) => ({ id: p.id, anio: p.anio, mes: p.mes, estado: p.estado }))}
      />
    </>
  );
}
