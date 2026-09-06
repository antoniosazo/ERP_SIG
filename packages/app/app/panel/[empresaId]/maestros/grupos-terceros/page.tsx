import { listarGruposTercero } from "@erp/db";
import { GruposTercerosManager } from "@/components/panel/grupos-terceros-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function GruposTercerosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const grupos = await listarGruposTercero(empresaId);

  return (
    <>
      <TypographyHeading
        title="Grupos de socios"
        description="Catálogo para segmentar clientes y proveedores (reportería). Se asigna en la ficha del socio."
      />
      <GruposTercerosManager
        empresaId={empresaId}
        grupos={grupos.map((g) => ({ id: g.id, codigo: g.codigo, nombre: g.nombre }))}
      />
    </>
  );
}
