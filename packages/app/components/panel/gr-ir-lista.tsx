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

export type EntradaGrIr = {
  id: string;
  numeroInterno: string | null;
  terceroId: string;
  proveedor: string;
  fechaEmision: string;
  valorPendiente: number;
};

const clp = (v: number) => v.toLocaleString("es-CL", { maximumFractionDigits: 0 });

export function GrIrLista({ empresaId, entradas }: { empresaId: string; entradas: EntradaGrIr[] }) {
  const total = entradas.reduce((a, e) => a + e.valorPendiente, 0);
  const porProveedor = useAgrupado(entradas, (e) => e.terceroId);
  const { expandidos, alternar } = useExpandidos();

  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">N° interno</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Valor pendiente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...porProveedor.entries()].map(([terceroId, items]) => {
            const abierto = expandidos.has(terceroId);
            const subtotal = items.reduce((a, e) => a + e.valorPendiente, 0);
            return (
              <Fragment key={terceroId}>
                <FilaGrupo abierto={abierto} onToggle={() => alternar(terceroId)} colSpan={3}>
                  {items[0]?.proveedor} ({items.length}) — {clp(subtotal)}
                </FilaGrupo>
                {abierto &&
                  items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono font-medium">
                        <Link
                          href={`/panel/${empresaId}/compras/documentos/${e.id}`}
                          className="hover:underline"
                        >
                          {e.numeroInterno ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {e.fechaEmision}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {clp(e.valorPendiente)}
                      </TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            );
          })}
          <TableRow className="font-medium">
            <TableCell colSpan={2} className="text-right">
              Saldo GR-IR
            </TableCell>
            <TableCell className="text-right tabular-nums">{clp(total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
