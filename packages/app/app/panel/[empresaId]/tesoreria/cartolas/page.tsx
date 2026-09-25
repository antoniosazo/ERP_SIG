import Link from "next/link";
import { listarCartolas, listarCuentasBancariasEmpresa } from "@erp/db";
import { CartolasLista } from "@/components/panel/cartolas-lista";
import { CartolaMovimientoManual } from "@/components/panel/cartola-movimiento-manual";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function CartolasPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [cartolas, cuentas] = await Promise.all([listarCartolas(empresaId), listarCuentasBancariasEmpresa(empresaId)]);
  const nombrePorCuenta = new Map(cuentas.map((c) => [c.id, `${c.bancoNombre} — ${c.numeroCuenta}${c.alias ? ` (${c.alias})` : ""}`]));

  return (
    <>
      <PageHeader
        title="Cartolas"
        description="Cartolas bancarias importadas o cargadas a mano, por cuenta."
        actions={
          <>
            <CartolaMovimientoManual
              empresaId={empresaId}
              cuentas={cuentas.filter((c) => c.activa).map((c) => ({ id: c.id, label: nombrePorCuenta.get(c.id)! }))}
            />
            <Button asChild>
              <Link href={`/panel/${empresaId}/tesoreria/cartolas/importar`}>Importar cartola</Link>
            </Button>
          </>
        }
      />
      <CartolasLista empresaId={empresaId} cartolas={cartolas} cuentaNombre={(id) => nombrePorCuenta.get(id) ?? "—"} />
    </>
  );
}
