"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generarEjercicioAction } from "@/lib/actions/periodos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Crea (o completa) los 12 meses de un ejercicio. Los meses existentes se conservan. */
export function GenerarEjercicioForm({
  empresaId,
  anioInicial,
  label = "Generar ejercicio",
}: {
  empresaId: string;
  anioInicial?: number;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [anio, setAnio] = useState(anioInicial ?? new Date().getFullYear());

  function generar() {
    startTransition(async () => {
      const r = await generarEjercicioAction(empresaId, anio);
      if (r.ok) {
        toast.success(
          r.creados === 0
            ? `El ejercicio ${anio} ya estaba completo`
            : `Ejercicio ${anio}: ${r.creados} periodo(s) creado(s)`,
        );
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/40 p-4">
      <div className="space-y-1">
        <Label htmlFor="anio" className="text-xs text-muted-foreground">
          Ejercicio
        </Label>
        <Input
          id="anio"
          type="number"
          min={2000}
          max={2100}
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="w-28"
        />
      </div>
      <Button onClick={generar} disabled={isPending}>
        {label}
      </Button>
      <p className="text-xs text-muted-foreground">
        Crea los 12 meses del año indicado. Los meses que ya existan se conservan.
      </p>
    </div>
  );
}
