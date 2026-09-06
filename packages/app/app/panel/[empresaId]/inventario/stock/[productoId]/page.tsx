import { notFound } from "next/navigation";
import { listarKardex, listarProductos } from "@erp/db";
import { TypographyHeading } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
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

const TIPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

export default async function KardexPage({
  params,
}: {
  params: Promise<{ empresaId: string; productoId: string }>;
}) {
  const { empresaId, productoId } = await params;
  const [productos, movimientos] = await Promise.all([
    listarProductos(empresaId),
    listarKardex(empresaId, productoId),
  ]);
  const producto = productos.find((p) => p.id === productoId);
  if (!producto) notFound();

  return (
    <>
      <TypographyHeading
        title={`Kardex — ${producto.codigo} ${producto.nombre}`}
        description="Movimientos de inventario del producto, más recientes primero. El saldo es el estado justo después del movimiento."
      />
      {movimientos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este producto no tiene movimientos.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Glosa</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead className="text-right">Costo total</TableHead>
                <TableHead className="text-right">Saldo cant.</TableHead>
                <TableHead className="text-right">Saldo prom.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{m.fecha}</TableCell>
                  <TableCell>
                    <Badge variant={m.tipo === "entrada" ? "secondary" : "outline"}>
                      {TIPO_LABEL[m.tipo] ?? m.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.glosa ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(m.cantidad, 4)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(m.costoUnitario, 4)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(m.costoTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(m.saldoCantidad, 4)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(m.saldoCostoPromedio, 4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
