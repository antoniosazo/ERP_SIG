import { empresaTieneAsientos, listarMonedasDeEmpresa } from "@erp/db";
import { MonedasManager } from "@/components/panel/monedas-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function MonedasPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [monedas, tieneAsientos] = await Promise.all([
    listarMonedasDeEmpresa(empresaId),
    empresaTieneAsientos(empresaId),
  ]);

  return (
    <>
      <TypographyHeading
        title="Monedas"
        description="Lista de monedas y unidades de reajuste de esta empresa (3.9). Se clona de la plantilla al crear la empresa y se ajusta aquí."
      />
      <MonedasManager
        empresaId={empresaId}
        bloqueado={tieneAsientos}
        monedas={monedas.map((m) => ({
          id: m.id,
          codigo: m.codigo,
          nombre: m.nombre,
          tipo: m.tipo,
          simbolo: m.simbolo,
          decimales: m.decimales,
          codigoIso: m.codigoIso,
        }))}
      />
    </>
  );
}
