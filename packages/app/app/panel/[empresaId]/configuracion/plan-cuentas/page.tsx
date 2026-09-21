import {
  cuentasConMovimientos,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  saldosDelPlan,
} from "@erp/db";
import { PlanCuentasManager } from "@/components/panel/plan-cuentas-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const esFecha = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function PlanCuentasPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ hasta?: string }>;
}) {
  const { empresaId } = await params;
  const { hasta: hastaParam } = await searchParams;
  const hasta = esFecha(hastaParam) ? hastaParam : new Date().toISOString().slice(0, 10);
  const [cuentas, conMovimientos, monedas, saldos] = await Promise.all([
    listarPlanCuentasDeEmpresa(empresaId),
    cuentasConMovimientos(empresaId),
    listarMonedasDeEmpresa(empresaId),
    saldosDelPlan(empresaId, hasta),
  ]);

  // Con saldo = debe − haber, la suma de las cuentas raíz de un ejercicio cuadrado es cero.
  const sumaRaices = Math.round(cuentas.filter((c) => !c.cuentaPadreId).reduce((a, c) => a + (saldos[c.id] ?? 0), 0) * 100) / 100;

  return (
    <>
      <TypographyHeading
        title="Plan de cuentas"
        description="Árbol contable con el saldo de cada cuenta a la fecha de corte (debe − haber: los saldos acreedores aparecen en negativo). La flecha junto al saldo abre el detalle de movimientos."
      />
      <p className={`text-xs ${sumaRaices === 0 ? "text-muted-foreground" : "text-destructive"}`}>
        Cuadratura al {hasta}: suma de las cuentas raíz = {sumaRaices.toLocaleString("es-CL")}{" "}
        {sumaRaices === 0 ? "✔ (debe = haber)" : "✘ el plan no cuadra"}
      </p>
      <PlanCuentasManager
        empresaId={empresaId}
        saldos={saldos}
        hasta={hasta}
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
