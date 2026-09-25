"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LibroContable } from "@erp/shared";
import { cerrarEjercicioActivoFijoAction, reabrirEjercicioActivoFijoAction } from "@/lib/actions/activos-fijos-cierre";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CerrarEjercicioActivoFijoBoton({
  empresaId,
  libro,
  anio,
}: {
  empresaId: string;
  libro: LibroContable;
  anio: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);

  function cerrar() {
    startTransition(async () => {
      const r = await cerrarEjercicioActivoFijoAction(empresaId, { libro, anio });
      if (r.ok) {
        toast.success(`Ejercicio ${anio} de ${libro} cerrado.`);
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <Button onClick={() => setAbierto(true)}>Cerrar ejercicio {anio}</Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Cerrar el ejercicio {anio} — {libro}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Congela el costo y la depreciación acumulada de cada activo al cierre del año. No genera asiento propio
            (el movimiento de dinero ya se contabilizó mes a mes). Solo se puede deshacer reabriendo el ejercicio.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending} onClick={cerrar}>
              {isPending ? "Cerrando…" : `Cerrar ejercicio ${anio}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReabrirEjercicioActivoFijoBoton({
  empresaId,
  libro,
  anio,
}: {
  empresaId: string;
  libro: LibroContable;
  anio: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function reabrir() {
    const motivo = prompt(`Motivo para reabrir el ejercicio ${anio} de ${libro}:`);
    if (!motivo?.trim()) return;
    startTransition(async () => {
      const r = await reabrirEjercicioActivoFijoAction(empresaId, { libro, anio, motivo });
      if (r.ok) {
        toast.success(`Ejercicio ${anio} de ${libro} reabierto.`);
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
