import {
  listarBancos,
  listarCuentasBancariasEmpresa,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
} from "@erp/db";
import { CuentasBancariasManager } from "@/components/panel/cuentas-bancarias-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function CuentasBancariasPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [cuentas, bancos, monedas, plan] = await Promise.all([
    listarCuentasBancariasEmpresa(empresaId),
    listarBancos(),
    listarMonedasDeEmpresa(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
  ]);
  return (
    <>
      <TypographyHeading
        title="Cuentas bancarias"
        description="Cuentas bancarias de la empresa. Cada una se contabiliza en una cuenta de tipo Banco del plan de cuentas."
      />
      <CuentasBancariasManager
        empresaId={empresaId}
        cuentas={cuentas}
        bancos={bancos.map((b) => ({ id: b.id, label: b.nombre }))}
        monedas={monedas.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }))}
        cuentasContables={plan
          .filter((c) => c.nivelImputable && c.activa && c.tipoCuenta === "Banco")
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
      />
    </>
  );
}
