"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PERIODO_ESTADO } from "@erp/shared";
import { cambiarEstadoPeriodoAction } from "@/lib/actions/periodos";
import { badgeVariantPeriodo } from "@/components/panel/periodos-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PeriodoLite = {
  id: string;
  anio: number;
  mes: number;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  fechaCierre: string | null;
  motivoReapertura: string | null;
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmt(fechaISO: string): string {
  const [a, m, d] = fechaISO.split("-");
  return `${d}/${m}/${a}`;
}

/** Tabla de los 12 meses de un ejercicio con cambio de "Status del período". */
export function PeriodosMesTable({
  empresaId,
  periodos,
}: {
  empresaId: string;
  periodos: PeriodoLite[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reapertura, setReapertura] = useState<PeriodoLite | null>(null);
  const [motivo, setMotivo] = useState("");

  const filas = [...periodos].sort((a, b) => a.mes - b.mes);

  function aplicarEstado(periodo: PeriodoLite, estado: string, motivoTexto?: string) {
    startTransition(async () => {
      const r = await cambiarEstadoPeriodoAction(empresaId, periodo.id, {
        estado: estado as (typeof PERIODO_ESTADO)[number],
        motivo: motivoTexto,
      });
      if (r.ok) {
        toast.success(`${MESES[periodo.mes - 1]} ${periodo.anio} → ${estado}`);
        setReapertura(null);
        setMotivo("");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function onCambioEstado(periodo: PeriodoLite, nuevo: string) {
    if (nuevo === periodo.estado) return;
    // Abrir un periodo que se cerró de verdad exige motivo; abrir uno recién generado no.
    if (nuevo === "Desbloqueado" && periodo.fechaCierre) {
      setMotivo("");
      setReapertura(periodo);
      return;
    }
    aplicarEstado(periodo, nuevo);
  }

  return (
    <>
      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Fecha contab. desde</TableHead>
              <TableHead>Hasta</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-56">Cambiar status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-muted-foreground">
                  {p.anio}-{String(p.mes).padStart(2, "0")}
                </TableCell>
                <TableCell>
                  {MESES[p.mes - 1]} {p.anio}
                  {p.motivoReapertura && (
                    <span className="block text-xs text-muted-foreground">
                      Reapertura: {p.motivoReapertura}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{fmt(p.fechaInicio)}</TableCell>
                <TableCell className="text-muted-foreground">{fmt(p.fechaFin)}</TableCell>
                <TableCell>
                  <Badge variant={badgeVariantPeriodo(p.estado)}>{p.estado}</Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={p.estado}
                    onValueChange={(v) => onCambioEstado(p, v)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODO_ESTADO.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={reapertura !== null}
        onOpenChange={(o) => {
          if (!o) {
            setReapertura(null);
            setMotivo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir periodo</DialogTitle>
            <DialogDescription>
              {reapertura && `${MESES[reapertura.mes - 1]} ${reapertura.anio}`} volverá a
              estado «Desbloqueado». El motivo queda registrado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo de la reapertura</Label>
            <Input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Ajuste de factura recibida fuera de plazo"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReapertura(null);
                setMotivo("");
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={isPending || !motivo.trim()}
              onClick={() => reapertura && aplicarEstado(reapertura, "Desbloqueado", motivo)}
            >
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
