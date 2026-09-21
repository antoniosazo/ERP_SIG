import {
  listarCuentasBancariasEmpresa,
  listarMetodosPago,
  listarPlanCuentasDeEmpresa,
} from "@erp/db";
import { MetodosPagoManager } from "@/components/panel/metodos-pago-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function MetodosPagoPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [metodos, cuentasBanc, plan] = await Promise.all([
    listarMetodosPago(empresaId),
    listarCuentasBancariasEmpresa(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
  ]);
  return (
    <>
      <TypographyHeading
        title="Métodos de pago"
        description="Definen cómo se cobra y se paga (efectivo, cheque, transferencia, tarjeta) y contra qué cuenta contable se registra."
      />
      <MetodosPagoManager
        empresaId={empresaId}
        metodos={metodos.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          tipo: m.tipo,
          sentido: m.sentido,
          cuentaBancariaId: m.cuentaBancariaId,
          cuentaContableId: m.cuentaContableId,
          activo: m.activo,
        }))}
        cuentasBancarias={cuentasBanc
          .filter((c) => c.activa)
          .map((c) => ({ id: c.id, label: `${c.bancoNombre} ${c.alias ?? c.numeroCuenta}` }))}
        cuentasContables={plan
          .filter(
            (c) => c.nivelImputable && c.activa && ["Banco", "Caja", "Otra"].includes(c.tipoCuenta),
          )
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
      />
    </>
  );
}
