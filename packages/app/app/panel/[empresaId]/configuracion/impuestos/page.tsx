import { listarImpuestosDeEmpresa, listarPlanCuentasDeEmpresa } from "@erp/db";
import { ImpuestosManager } from "@/components/panel/impuestos-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function ImpuestosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [impuestos, cuentas] = await Promise.all([
    listarImpuestosDeEmpresa(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
  ]);

  const cuentaOpts = cuentas
    .filter((c) => c.nivelImputable && c.activa)
    .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }));

  return (
    <>
      <TypographyHeading
        title="Impuestos"
        description="Maestro de impuestos de la empresa: IVA débito/crédito, impuesto adicional, exento y no afecto, con su cuenta contable."
      />
      <ImpuestosManager
        empresaId={empresaId}
        cuentas={cuentaOpts}
        impuestos={impuestos.map((i) => ({
          id: i.id,
          codigo: i.codigo,
          nombre: i.nombre,
          tipo: i.tipo,
          tasa: i.tasa,
          cuentaContableId: i.cuentaContableId,
          recuperableDefault: i.recuperableDefault,
          aplicaA: i.aplicaA,
          activo: i.activo,
        }))}
      />
    </>
  );
}
