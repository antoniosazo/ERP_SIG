"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LIBRO_CONTABLE, type LibroContable } from "@erp/shared";
import type { SimulacionDepreciacion } from "@erp/db";
import { ejecutarDepreciacionAction } from "@/lib/actions/activos-fijos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PeriodoOpcion = { id: string; anio: number; mes: number; estado: string };

const fmt = (n: number) => n.toLocaleString("es-CL");

export function DepreciacionRunner({
  empresaId,
  periodos,
}: {
  empresaId: string;
  periodos: PeriodoOpcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [libro, setLibro] = useState<LibroContable>("Ambos");
  const [periodoId, setPeriodoId] = useState(periodos[0]?.id ?? "");
  const [simulacion, setSimulacion] = useState<SimulacionDepreciacion | null>(null);

  function simular() {
    if (!periodoId) return;
    startTransition(async () => {
      const result = await ejecutarDepreciacionAction(empresaId, { libro, periodoId, modo: "simulacion" });
      if (result.ok && result.modo === "simulacion") {
        setSimulacion(result.data);
        if (result.data.filas.length === 0) toast.info("Ningún activo tiene cuota de depreciación en este período.");
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function confirmar() {
    startTransition(async () => {
      const result = await ejecutarDepreciacionAction(empresaId, { libro, periodoId, modo: "real" });
      if (result.ok && result.modo === "real") {
        toast.success(`Depreciación contabilizada: ${result.activos} activos, total ${fmt(result.totalCuota)}`);
        setSimulacion(null);
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Libro</Label>
            <Select value={libro} onValueChange={(v) => setLibro(v as LibroContable)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIBRO_CONTABLE.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodoId} onValueChange={setPeriodoId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.anio}-{String(p.mes).padStart(2, "0")} ({p.estado})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={simular} disabled={isPending || !periodoId}>
              {isPending ? "Calculando..." : "Simular"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {simulacion && (
        <div className="space-y-3">
          <div className="rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Costo depreciable</TableHead>
                  <TableHead className="text-right">Dep. acumulada</TableHead>
                  <TableHead className="text-right">Cuota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulacion.filas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Sin cuotas para este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  simulacion.filas.map((f) => (
                    <TableRow key={f.activoId}>
                      <TableCell className="font-mono text-muted-foreground">{f.codigo}</TableCell>
                      <TableCell>{f.descripcion}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(f.costoDepreciable)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(f.depAcumuladaAlInicio)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{fmt(f.cuota)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {simulacion.filas.length > 0 && (
                <tfoot>
                  <TableRow className="border-t-2 bg-muted/40 font-semibold">
                    <TableCell colSpan={4}>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(simulacion.totalCuota)}</TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>
          {simulacion.filas.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={confirmar} disabled={isPending}>
                {isPending ? "Contabilizando..." : "Confirmar y contabilizar"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
