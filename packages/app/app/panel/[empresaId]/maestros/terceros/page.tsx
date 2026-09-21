import { listarGruposTercero, listarTerceros, saldosDeTerceros } from "@erp/db";
import { TercerosManager } from "@/components/panel/terceros-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function TercerosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [terceros, grupos, saldos] = await Promise.all([
    listarTerceros(empresaId),
    listarGruposTercero(empresaId),
    saldosDeTerceros(empresaId, new Date().toISOString().slice(0, 10)),
  ]);

  return (
    <>
      <TypographyHeading
        title="Socios de negocio"
        description="Maestro de clientes, proveedores y prestadores de honorarios (3.6). Cada socio muestra su saldo por cobrar o por pagar a hoy; ábrelo para ver su cuenta corriente y editar sus datos."
      />
      <TercerosManager
        empresaId={empresaId}
        saldos={saldos}
        grupos={grupos.map((g) => ({ id: g.id, label: `${g.codigo} — ${g.nombre}` }))}
        terceros={terceros.map((t) => ({
          id: t.id,
          codigo: t.codigo,
          rut: t.rut,
          razonSocial: t.razonSocial,
          tipoTercero: t.tipoTercero,
          grupoId: t.grupoId,
          activo: t.activo,
          bloqueado: t.bloqueado,
        }))}
      />
    </>
  );
}
