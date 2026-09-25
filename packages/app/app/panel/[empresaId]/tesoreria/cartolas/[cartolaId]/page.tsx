import { notFound } from "next/navigation";
import { listarCuentasBancariasEmpresa, obtenerCartolaConMovimientos } from "@erp/db";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const fmt = (n: string | number) => Number(n).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function CartolaDetallePage({
  params,
}: {
  params: Promise<{ empresaId: string; cartolaId: string }>;
}) {
  const { empresaId, cartolaId } = await params;
  const [cartola, cuentas] = await Promise.all([
    obtenerCartolaConMovimientos(cartolaId, empresaId),
    listarCuentasBancariasEmpresa(empresaId),
  ]);
  if (!cartola) notFound();
  const cuenta = cuentas.find((c) => c.id === cartola.cuentaBancariaId);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Cartolas", href: `/panel/${empresaId}/tesoreria/cartolas` }, { label: `${cartola.fechaDesde} — ${cartola.fechaHasta}` }]}
        title={cuenta ? `${cuenta.bancoNombre} — ${cuenta.numeroCuenta}` : "Cartola"}
        description={`${cartola.fechaDesde} al ${cartola.fechaHasta} · ${cartola.origen}${cartola.archivoNombre ? ` · ${cartola.archivoNombre}` : ""}`}
      />

      <div className="grid gap-3 sm:grid-cols-4 rounded-xl border p-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Saldo inicial</div>
          <div className="tabular-nums">{fmt(cartola.saldoInicial)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Saldo final</div>
          <div className="tabular-nums">{fmt(cartola.saldoFinal)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Movimientos</div>
          <div className="tabular-nums">{cartola.movimientos.length}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Estado</div>
          <Badge variant={cartola.estado === "Importada" ? "default" : "secondary"}>{cartola.estado}</Badge>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>N° documento</TableHead>
              <TableHead>RUT contraparte</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cartola.movimientos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  Sin movimientos.
                </TableCell>
              </TableRow>
            )}
            {cartola.movimientos.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap">{m.fecha}</TableCell>
                <TableCell>{m.descripcion}</TableCell>
                <TableCell className="text-muted-foreground">{m.nroDocumento ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.rutContraparte ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(m.monto)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
