import Link from "next/link";
import { listarStockDeEmpresa } from "@erp/db";
import { TypographyHeading } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const num = (v: unknown, d = 0) =>
  Number(v).toLocaleString("es-CL", { maximumFractionDigits: d });

export default async function StockPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const filas = await listarStockDeEmpresa(empresaId);
  const valorTotal = filas.reduce((a, f) => a + Number(f.valor), 0);

  return (
    <>
      <TypographyHeading
        title="Existencias"
        description="Saldo de inventario por producto (un almacén implícito por empresa), valorado a promedio ponderado móvil."
      />
      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay movimientos de stock.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo promedio</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow key={f.productoId}>
                  <TableCell className="font-mono">
                    <Link
                      href={`/panel/${empresaId}/inventario/stock/${f.productoId}`}
                      className="hover:underline"
                    >
                      {f.codigo}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{f.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(f.cantidad, 4)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(f.costoPromedio, 4)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(f.valor)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell colSpan={4} className="text-right">
                  Valor total del inventario
                </TableCell>
                <TableCell className="text-right tabular-nums">{num(valorTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
