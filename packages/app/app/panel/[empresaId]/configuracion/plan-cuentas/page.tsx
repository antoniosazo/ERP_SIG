import { notFound } from "next/navigation";
import { fechasConsultaCuenta, puedeEditarPlanCuentas } from "@erp/shared";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { FiltroFechasCuentas } from "@/components/panel/filtro-fechas-cuentas";
import {
  cuentasConMovimientos,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  saldosDelPlan,
} from "@erp/db";
import { PlanCuentasManager } from "@/components/panel/plan-cuentas-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function PlanCuentasPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ hasta?: string | string[] }>;
}) {
  const { empresaId } = await params;
  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();
  const { hasta, error } = fechasConsultaCuenta(await searchParams, new Date().toISOString().slice(0, 10));
  if (error) return <>
    <TypographyHeading title="Plan de cuentas" description="Corrige la fecha de corte para consultar los saldos." />
    <FiltroFechasCuentas hasta={hasta} error={error} />
  </>;
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
        puedeEditar={puedeEditarPlanCuentas(acceso.session.user.esAdminFirma, acceso.rol)}
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
