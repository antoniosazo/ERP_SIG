import {
  cuentasConMovimientos,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
} from "@erp/db";
import { PlanCuentasManager } from "@/components/panel/plan-cuentas-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function PlanCuentasPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [cuentas, conMovimientos, monedas] = await Promise.all([
    listarPlanCuentasDeEmpresa(empresaId),
    cuentasConMovimientos(empresaId),
    listarMonedasDeEmpresa(empresaId),
  ]);

  return (
    <>
      <TypographyHeading
        title="Plan de cuentas"
        description="Árbol contable de la empresa (3.2). Alta y edición de cuentas; las hijas heredan la clase de su raíz."
      />
      <PlanCuentasManager
        empresaId={empresaId}
        monedas={monedas.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }))}
        cuentas={cuentas.map((c) => ({
          id: c.id,
          codigoCuenta: c.codigoCuenta,
          nombreCuenta: c.nombreCuenta,
          clase: c.clase,
          naturaleza: c.naturaleza,
          tipoCuenta: c.tipoCuenta,
          clasificacionCorriente: c.clasificacionCorriente,
          cuentaPadreId: c.cuentaPadreId,
          nivelImputable: c.nivelImputable,
          requiereCentroCosto: c.requiereCentroCosto,
          requiereAnalisisTerceros: c.requiereAnalisisTerceros,
          modoMoneda: c.modoMoneda,
          monedaFijaId: c.monedaFijaId,
          relevanteFlujoCaja: c.relevanteFlujoCaja,
          esCuentaAjuste: c.esCuentaAjuste,
          activa: c.activa,
          tieneMovimientos: conMovimientos.has(c.id),
        }))}
      />
    </>
  );
}
