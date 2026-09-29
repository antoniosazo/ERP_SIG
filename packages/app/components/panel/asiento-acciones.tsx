"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { anularAsientoAction, ejecutarReversionesAction } from "@/lib/actions/asientos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** SAP B1 "Datos → Cancelar": pide motivo y fecha, y crea el asiento de reversa. */
export function AsientoAnularBoton({
  empresaId,
  asientoId,
  fechaOriginal,
}: {
  empresaId: string;
  asientoId: string;
  fechaOriginal: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(fechaOriginal);
  const [isPending, startTransition] = useTransition();

  function anular() {
    startTransition(async () => {
      const r = await anularAsientoAction(empresaId, asientoId, { motivo, fecha });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Asiento anulado con la reversa N° ${r.correlativo}.`);
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setAbierto(true)}>
        Anular (revertir)
      </Button>
      <Dialog open={abierto} onOpenChange={(v) => !isPending && setAbierto(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular asiento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se crea un asiento de reversa con debe y haber invertidos. El original se conserva, como exige la trazabilidad contable.
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="fechaReversa">Fecha de la reversa</Label>
              <Input id="fechaReversa" type="date" min={fechaOriginal} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo</Label>
              <Input id="motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={isPending || !motivo.trim() || !fecha} onClick={anular}>
              {isPending ? "Anulando…" : "Crear reversa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** SAP B1 "Revertir transacciones": contabiliza las reversiones programadas vencidas. */
export function EjecutarReversionesBoton({ empresaId, cantidad }: { empresaId: string; cantidad: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function ejecutar() {
    startTransition(async () => {
      const r = await ejecutarReversionesAction(empresaId);
      if (!r.ok) return void toast.error(r.error);
      if (r.hechas) toast.success(`${r.hechas} reversión(es) contabilizada(s).`);
      for (const e of r.errores) toast.error(e);
      router.refresh();
    });
  }
  return (
    <Button type="button" size="sm" disabled={isPending} onClick={ejecutar}>
      {isPending ? "Revirtiendo…" : `Ejecutar ${cantidad} reversión(es)`}
    </Button>
  );
}
