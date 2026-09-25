import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmt = (n: string | number) => Number(n).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type CartolaListaFila = {
  id: string;
  cuentaBancariaId: string;
  fechaDesde: string;
  fechaHasta: string;
  saldoInicial: string;
  saldoFinal: string;
  origen: string;
  archivoNombre: string | null;
  estado: string;
  cantidadMovimientos: number;
};

export function CartolasLista({
  empresaId,
  cartolas,
  cuentaNombre,
}: {
  empresaId: string;
  cartolas: CartolaListaFila[];
  cuentaNombre: (cuentaBancariaId: string) => string;
}) {
  if (cartolas.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no se han importado cartolas para esta empresa.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cuenta</TableHead>
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Saldo inicial</TableHead>
            <TableHead className="text-right">Saldo final</TableHead>
            <TableHead className="text-right">Movimientos</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cartolas.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/panel/${empresaId}/tesoreria/cartolas/${c.id}`} className="hover:underline">
                  {cuentaNombre(c.cuentaBancariaId)}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {c.fechaDesde} — {c.fechaHasta}
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmt(c.saldoInicial)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(c.saldoFinal)}</TableCell>
              <TableCell className="text-right tabular-nums">{c.cantidadMovimientos}</TableCell>
              <TableCell className="text-muted-foreground">{c.origen}</TableCell>
              <TableCell>
                <Badge variant={c.estado === "Importada" ? "default" : "secondary"}>{c.estado}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
