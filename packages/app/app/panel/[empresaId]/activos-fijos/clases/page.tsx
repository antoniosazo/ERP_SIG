import { listarClasesActivoFijo, listarCuentasClasesDeEmpresa, listarPlanCuentasDeEmpresa } from "@erp/db";
import { ActivosFijosClasesManager } from "@/components/panel/activos-fijos-clases-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function ClasesActivoFijoPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [clases, cuentasClase, cuentas] = await Promise.all([
    listarClasesActivoFijo(empresaId),
    listarCuentasClasesDeEmpresa(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
  ]);

  return (
    <>
      <TypographyHeading
        title="Clases de activo"
        description="Agrupan los activos y definen sus cuentas contables por defecto (AF_CLASE)."
      />
      <ActivosFijosClasesManager
        empresaId={empresaId}
        clases={clases}
        cuentasClase={cuentasClase}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
      />
    </>
  );
}
