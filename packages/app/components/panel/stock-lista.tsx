"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilaGrupo, useAgrupado, useExpandidos } from "./tabla-agrupada";

export type StockFila = {
  productoId: string;
  codigo: string;
  nombre: string;
  grupoId: string;
  grupoNombre: string;
  cantidad: number;
  costoPromedio: number;
  valor: number;
};

const num = (v: number, d = 0) => v.toLocaleString("es-CL", { maximumFractionDigits: d });

export function StockLista({ empresaId, filas }: { empresaId: string; filas: StockFila[] }) {
  const valorTotal = filas.reduce((a, f) => a + f.valor, 0);
  const porGrupo = useAgrupado(filas, (f) => f.grupoId);
  const { expandidos, alternar } = useExpandidos();

  return (
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
          {[...porGrupo.entries()].map(([grupoId, items]) => {
            const abierto = expandidos.has(grupoId);
            const valorGrupo = items.reduce((a, f) => a + f.valor, 0);
            return (
              <Fragment key={grupoId}>
                <FilaGrupo abierto={abierto} onToggle={() => alternar(grupoId)} colSpan={5}>
                  {items[0]?.grupoNombre} ({items.length}) — {num(valorGrupo)}
                </FilaGrupo>
                {abierto &&
                  items.map((f) => (
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
                      <TableCell className="text-right tabular-nums">
                        {num(f.costoPromedio, 4)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{num(f.valor)}</TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            );
          })}
          <TableRow className="font-medium">
            <TableCell colSpan={4} className="text-right">
              Valor total del inventario
            </TableCell>
            <TableCell className="text-right tabular-nums">{num(valorTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
