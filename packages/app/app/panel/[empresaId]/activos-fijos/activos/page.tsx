import { listarActivosFijos, listarCentrosCosto, listarClasesActivoFijo, listarVidasUtilesSii } from "@erp/db";
import { ActivosFijosManager } from "@/components/panel/activos-fijos-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function ActivosFijosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [activos, clases, centros, vidasUtilesSii] = await Promise.all([
    listarActivosFijos(empresaId),
    listarClasesActivoFijo(empresaId),
    listarCentrosCosto(empresaId),
    listarVidasUtilesSii(empresaId),
  ]);

  return (
    <>
      <TypographyHeading title="Activos" description="Maestro de activos fijos de la empresa." />
      <ActivosFijosManager
        empresaId={empresaId}
        activos={activos}
        clases={clases.filter((c) => c.activa).map((c) => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` }))}
        centros={centros
          .filter((c) => c.estado === "Activo")
          .map((c) => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` }))}
        vidasUtilesSii={vidasUtilesSii
          .filter((v) => v.activa)
          .map((v) => ({ id: v.id, categoria: v.categoria, vidaUtilNormalMeses: v.vidaUtilNormalMeses }))}
      />
    </>
  );
}
