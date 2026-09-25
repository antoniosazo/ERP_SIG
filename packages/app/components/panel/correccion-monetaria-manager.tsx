"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  aplicarCorreccionMonetariaAction,
  guardarFactorCorreccionMonetariaAction,
} from "@/lib/actions/activos-fijos-tributario";
import type { FilaCorreccionMonetaria } from "@erp/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type FactorCmLite = { id: string; anio: number; mes: number; factorPorcentaje: string };

const fmt = (n: number) => n.toLocaleString("es-CL");
const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function CorreccionMonetariaManager({ empresaId, factores }: { empresaId: string; factores: FactorCmLite[] }) {
  const router = useRouter();
  const [isPendingFactor, startFactor] = useTransition();
  const [anioFactor, setAnioFactor] = useState(new Date().getFullYear());
  const [mesFactor, setMesFactor] = useState(1);
  const [valorFactor, setValorFactor] = useState("");

  const [isPendingCm, startCm] = useTransition();
  const [anioCm, setAnioCm] = useState(new Date().getFullYear());
  const [simulacion, setSimulacion] = useState<{ filas: FilaCorreccionMonetaria[]; totalAjusteCosto: number; totalAjusteDepAcumulada: number } | null>(null);

  function guardarFactor() {
    const factorPorcentaje = Number(valorFactor);
    if (Number.isNaN(factorPorcentaje)) {
      toast.error("Indica un factor válido");
      return;
    }
    startFactor(async () => {
      const result = await guardarFactorCorreccionMonetariaAction(empresaId, { anio: anioFactor, mes: mesFactor, factorPorcentaje });
      if (result.ok) {
        toast.success("Factor guardado");
        setValorFactor("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function simular() {
    startCm(async () => {
      const result = await aplicarCorreccionMonetariaAction(empresaId, { anio: anioCm, modo: "simulacion" });
      if (result.ok && result.modo === "simulacion") {
        setSimulacion({ filas: result.filas, totalAjusteCosto: result.totalAjusteCosto, totalAjusteDepAcumulada: result.totalAjusteDepAcumulada });
        if (result.filas.length === 0) toast.info("No hay ajuste de corrección monetaria para este año.");
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function confirmar() {
    startCm(async () => {
      const result = await aplicarCorreccionMonetariaAction(empresaId, { anio: anioCm, modo: "real" });
      if (result.ok && result.modo === "real") {
        toast.success(`Corrección monetaria contabilizada: ${result.activos} activos.`);
        setSimulacion(null);
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Factores mensuales (variación IPC, publicados por el SII)</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="anioFactor" className="text-xs">Año</Label>
            <Input id="anioFactor" type="number" className="h-8 w-24" value={anioFactor} onChange={(e) => setAnioFactor(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mes</Label>
            <Select value={String(mesFactor)} onValueChange={(v) => setMesFactor(Number(v))}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOMBRES_MES.map((n, i) => (
                  <SelectItem key={n} value={String(i + 1)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="valorFactor" className="text-xs">Factor (%)</Label>
            <Input id="valorFactor" type="number" step="0.01" className="h-8 w-28" value={valorFactor} onChange={(e) => setValorFactor(e.target.value)} />
          </div>
          <Button size="sm" onClick={guardarFactor} disabled={isPendingFactor}>
            {isPendingFactor ? "Guardando..." : "Guardar factor"}
          </Button>
        </div>

        {factores.length > 0 && (
          <div className="max-h-72 overflow-y-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Factor (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factores.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{NOMBRES_MES[f.mes - 1]} {f.anio}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(f.factorPorcentaje).toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Aplicar corrección monetaria (libro Tributario)</h3>
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div className="space-y-1">
              <Label htmlFor="anioCm" className="text-xs">Año</Label>
              <Input id="anioCm" type="number" className="h-8 w-24" value={anioCm} onChange={(e) => setAnioCm(Number(e.target.value))} />
            </div>
            <Button size="sm" onClick={simular} disabled={isPendingCm}>
              {isPendingCm ? "Calculando..." : "Simular"}
            </Button>
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
                    <TableHead className="text-right">Ajuste costo</TableHead>
                    <TableHead className="text-right">Ajuste dep. acumulada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {simulacion.filas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">Sin ajustes para este año.</TableCell>
                    </TableRow>
                  ) : (
                    simulacion.filas.map((f) => (
                      <TableRow key={f.activoId}>
                        <TableCell className="font-mono text-muted-foreground">{f.codigo}</TableCell>
                        <TableCell>{f.descripcion}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(f.ajusteCosto)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(f.ajusteDepAcumulada)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {simulacion.filas.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={confirmar} disabled={isPendingCm}>
                  {isPendingCm ? "Contabilizando..." : "Confirmar y contabilizar"}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
