"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cerrarEjercicioAction, reabrirEjercicioAction } from "@/lib/actions/cierre-ejercicio";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Opcion = { id: string; label: string };

export function CerrarEjercicioBoton({
  empresaId,
  anio,
  cuentas,
  cuentaSugeridaId,
}: {
  empresaId: string;
  anio: number;
  cuentas: Opcion[];
  cuentaSugeridaId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [cuentaId, setCuentaId] = useState(cuentaSugeridaId ?? "");

  function cerrar() {
    startTransition(async () => {
      const r = await cerrarEjercicioAction(empresaId, { anio, cuentaResultadoId: cuentaId });
      if (r.ok) {
        toast.success(`Ejercicio ${anio} cerrado y contabilizado.`);
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <Button onClick={() => setAbierto(true)} disabled={cuentas.length === 0}>
        Cerrar ejercicio {anio}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar el ejercicio {anio}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se genera un asiento que deja en cero las cuentas de Ingresos y Costos y Gastos del año y
            traspasa el resultado a la cuenta que elijas. Queda contabilizado de inmediato; solo se
            puede deshacer reabriendo el ejercicio.
          </p>
          <div className="space-y-2">
            <Label htmlFor="cuentaResultado">Cuenta de resultado (Patrimonio)</Label>
            <Select value={cuentaId || undefined} onValueChange={setCuentaId}>
              <SelectTrigger id="cuentaResultado" className="w-full">
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending || !cuentaId} onClick={cerrar}>
              {isPending ? "Cerrando…" : `Cerrar ejercicio ${anio}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReabrirEjercicioBoton({ empresaId, anio }: { empresaId: string; anio: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function reabrir() {
    const motivo = prompt(`Motivo para reabrir el ejercicio ${anio}:`);
    if (!motivo?.trim()) return;
    startTransition(async () => {
      const r = await reabrirEjercicioAction(empresaId, { anio, motivo });
      if (r.ok) {
        toast.success(`Ejercicio ${anio} reabierto: se generó el asiento de reversa.`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Button type="button" variant="destructive" disabled={isPending} onClick={reabrir}>
      {isPending ? "Reabriendo…" : `Reabrir ejercicio ${anio}`}
    </Button>
  );
}
