import { listarPlanCuentasDeEmpresa, listarReglasDeterminacion } from "@erp/db";
import { DeterminacionCuentasManager } from "@/components/panel/determinacion-cuentas-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function DeterminacionCuentasPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [reglas, cuentas] = await Promise.all([
    listarReglasDeterminacion(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
  ]);

  return (
    <>
      <TypographyHeading
        title="Determinación de cuentas"
        description="Cuentas por defecto de la empresa por rol contable (nivel GENERAL). Los overrides por categoría / producto / grupo / impuesto siguen teniendo prioridad."
      />
      <DeterminacionCuentasManager
        empresaId={empresaId}
        reglas={reglas.map((r) => ({ contexto: r.contexto, rol: r.rol, cuentaId: r.cuentaId }))}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
      />
    </>
  );
}
