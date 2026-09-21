"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PagoTipo } from "@erp/shared";
import { PAGO_META } from "@/lib/pagos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type PagoFila = {
  id: string;
  numeroInterno: string;
  fechaPago: string;
  tercero: string;
  medios: string;
  montoTotal: number;
  montoAplicado: number;
  estado: string;
};

const fmt = (n: number) => n.toLocaleString("es-CL");

export function PagosLista({
  empresaId,
  tipo,
  filas,
}: {
  empresaId: string;
  tipo: PagoTipo;
  filas: PagoFila[];
}) {
  const router = useRouter();
  const meta = PAGO_META[tipo];
  const base = `/panel/${empresaId}/tesoreria/${meta.slug}`;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href={`${base}/nuevo`}>Nuevo {meta.singular}</Link>
        </Button>
      </div>
      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay {meta.titulo.toLowerCase()}.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">N°</TableHead>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead>{meta.tercero}</TableHead>
                <TableHead>Medios</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Aplicado</TableHead>
                <TableHead className="text-right">Anticipo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) return;
                    router.push(`${base}/${p.id}`);
                  }}
                >
                  <TableCell className="font-mono font-medium">
                    <Link href={`${base}/${p.id}`} className="hover:underline">
                      {p.numeroInterno}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{p.fechaPago}</TableCell>
                  <TableCell>{p.tercero}</TableCell>
                  <TableCell className="text-muted-foreground">{p.medios || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(p.montoTotal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(p.montoAplicado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(Math.max(p.montoTotal - p.montoAplicado, 0))}</TableCell>
                  <TableCell>
                    <Badge variant={p.estado === "contabilizado" ? "default" : "secondary"}>
                      {p.estado === "contabilizado" ? "Contabilizado" : "Anulado"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
