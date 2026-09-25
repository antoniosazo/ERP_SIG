import { listarCuentasBancariasEmpresa, listarFormatosCartola } from "@erp/db";
import { CartolaImportarForm } from "@/components/panel/cartola-importar-form";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function ImportarCartolaPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [cuentas, formatos] = await Promise.all([listarCuentasBancariasEmpresa(empresaId), listarFormatosCartola(empresaId)]);

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Cartolas", href: `/panel/${empresaId}/tesoreria/cartolas` },
          { label: "Importar" },
        ]}
        title="Importar cartola"
        description="Sube el archivo, revisa la vista previa y confirma la importación."
      />
      <CartolaImportarForm
        empresaId={empresaId}
        cuentas={cuentas.map((c) => ({ id: c.id, label: `${c.bancoNombre} — ${c.numeroCuenta}${c.alias ? ` (${c.alias})` : ""}`, bancoId: c.bancoId }))}
        formatos={formatos.filter((f) => f.activo).map((f) => ({ id: f.id, label: f.nombre, bancoId: f.bancoId }))}
      />
    </>
  );
}
