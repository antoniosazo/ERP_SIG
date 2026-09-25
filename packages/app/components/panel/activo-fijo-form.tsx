"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ACTIVO_FIJO_REGIMEN_DEPRECIACION, LIBRO_CONTABLE, crearActivoFijoSchema } from "@erp/shared";
import { crearActivoFijoAction, editarActivoFijoAction } from "@/lib/actions/activos-fijos";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Opcion = { id: string; label: string };
type FormValues = z.input<typeof crearActivoFijoSchema>;
const SIN_CENTRO = "__none__";

export type ActivoFijoExistente = {
  id: string;
  descripcion: string;
  claseId: string | null;
  centroCostoId: string | null;
  ubicacion: string | null;
  numeroSerie: string | null;
  marca: string | null;
  modelo: string | null;
  fechaAdquisicion: string | null;
  valoracion?: {
    libro: string;
    reglaInicio: string;
    fechaInicioDep: string | null;
    vidaUtilMeses: number;
    valorResidual: string;
    regimenDepreciacion?: string;
    vidaUtilNormalMeses?: number | null;
  };
};

function valoresDe(activo: ActivoFijoExistente | null): FormValues {
  const v = activo?.valoracion;
  return {
    descripcion: activo?.descripcion ?? "",
    claseId: activo?.claseId ?? "",
    centroCostoId: activo?.centroCostoId ?? undefined,
    ubicacion: activo?.ubicacion ?? undefined,
    numeroSerie: activo?.numeroSerie ?? undefined,
    marca: activo?.marca ?? undefined,
    modelo: activo?.modelo ?? undefined,
    fechaAdquisicion: activo?.fechaAdquisicion ?? undefined,
    valoraciones: [
      {
        libro: (v?.libro as FormValues["valoraciones"][number]["libro"]) ?? "Ambos",
        metodoDep: v?.regimenDepreciacion === "Instantanea" ? "Inmediata" : "Lineal",
        reglaInicio: (v?.reglaInicio as FormValues["valoraciones"][number]["reglaInicio"]) ?? "Mes siguiente",
        reglaBaja: "Hasta mes anterior",
        fechaInicioDep: v?.fechaInicioDep ?? "",
        vidaUtilMeses: v?.vidaUtilMeses ?? 0,
        valorResidual: v ? Number(v.valorResidual) : 0,
        regimenDepreciacion:
          (v?.regimenDepreciacion as FormValues["valoraciones"][number]["regimenDepreciacion"]) ?? "Normal",
        vidaUtilNormalMeses: v?.vidaUtilNormalMeses ?? undefined,
      },
    ],
  };
}

/** Formulario de alta / edición de un activo — Fase 1: una sola valoración (libro único). */
export function ActivoFijoForm({
  empresaId,
  clases,
  centros,
  vidasUtilesSii = [],
  activo,
  onSaved,
}: {
  empresaId: string;
  clases: Opcion[];
  centros: Opcion[];
  vidasUtilesSii?: { id: string; categoria: string; vidaUtilNormalMeses: number }[];
  activo?: ActivoFijoExistente | null;
  onSaved?: (activoId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(crearActivoFijoSchema),
    defaultValues: valoresDe(activo ?? null),
  });

  const libroSeleccionado = watch("valoraciones.0.libro");
  const regimenSeleccionado = watch("valoraciones.0.regimenDepreciacion");

  function cambiarRegimen(regimen: FormValues["valoraciones"][number]["regimenDepreciacion"]) {
    setValue("valoraciones.0.regimenDepreciacion", regimen);
    if (regimen === "Instantanea") {
      setValue("valoraciones.0.metodoDep", "Inmediata");
      setValue("valoraciones.0.vidaUtilMeses", 1);
    } else {
      setValue("valoraciones.0.metodoDep", "Lineal");
      if (regimen === "Normal") setValue("valoraciones.0.vidaUtilNormalMeses", undefined);
    }
  }

  function elegirVidaUtilSii(vidaUtilNormalMeses: number) {
    setValue("valoraciones.0.vidaUtilNormalMeses", vidaUtilNormalMeses);
    setValue("valoraciones.0.vidaUtilMeses", Math.max(12, Math.round(vidaUtilNormalMeses / 3)));
  }

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = activo
        ? await editarActivoFijoAction(empresaId, activo.id, data)
        : await crearActivoFijoAction(empresaId, data);
      if (result.ok) {
        toast.success(activo ? "Activo actualizado" : "Activo creado");
        router.refresh();
        onSaved?.(result.id);
      } else {
        toast.error(result.error);
      }
    });
  });

  const errV = errors.valoraciones?.[0];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Input id="descripcion" {...register("descripcion")} />
        {errors.descripcion && <p className="text-sm text-destructive">{errors.descripcion.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="claseId">Clase de activo</Label>
          <Select value={watch("claseId")} onValueChange={(v) => setValue("claseId", v)}>
            <SelectTrigger id="claseId" className="w-full">
              <SelectValue placeholder="Selecciona una clase" />
            </SelectTrigger>
            <SelectContent>
              {clases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.claseId && <p className="text-sm text-destructive">{errors.claseId.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="centroCostoId">Centro de costo</Label>
          <Select
            value={watch("centroCostoId") ?? SIN_CENTRO}
            onValueChange={(v) => setValue("centroCostoId", v === SIN_CENTRO ? undefined : v)}
          >
            <SelectTrigger id="centroCostoId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_CENTRO}>Sin centro de costo</SelectItem>
              {centros.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ubicacion">Ubicación</Label>
          <Input id="ubicacion" {...register("ubicacion")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="marca">Marca</Label>
          <Input id="marca" {...register("marca")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="modelo">Modelo</Label>
          <Input id="modelo" {...register("modelo")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="numeroSerie">N° de serie</Label>
          <Input id="numeroSerie" {...register("numeroSerie")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaAdquisicion">Fecha de adquisición</Label>
          <DatePicker id="fechaAdquisicion" {...register("fechaAdquisicion")} />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-input p-4">
        <p className="text-sm font-medium">Valoración y depreciación</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="libro">Libro contable</Label>
            <Select
              value={watch("valoraciones.0.libro")}
              onValueChange={(v) => setValue("valoraciones.0.libro", v as FormValues["valoraciones"][number]["libro"])}
            >
              <SelectTrigger id="libro" className="w-full">
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
            <Label htmlFor="reglaInicio">Regla de inicio de depreciación</Label>
            <Select
              value={watch("valoraciones.0.reglaInicio")}
              onValueChange={(v) =>
                setValue("valoraciones.0.reglaInicio", v as FormValues["valoraciones"][number]["reglaInicio"])
              }
            >
              <SelectTrigger id="reglaInicio" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mes siguiente">Mes siguiente a la fecha de inicio</SelectItem>
                <SelectItem value="Inicio de mes">Desde el mes de la fecha de inicio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="fechaInicioDep">Fecha de inicio de depreciación</Label>
            <DatePicker id="fechaInicioDep" {...register("valoraciones.0.fechaInicioDep")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vidaUtilMeses">Vida útil (meses)</Label>
            <Input
              id="vidaUtilMeses"
              type="number"
              min={1}
              {...register("valoraciones.0.vidaUtilMeses", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valorResidual">Valor residual</Label>
            <MoneyInput
              id="valorResidual"
              value={watch("valoraciones.0.valorResidual") ?? 0}
              onValueChange={(v) => setValue("valoraciones.0.valorResidual", v ?? 0)}
            />
          </div>
        </div>
        {errV && <p className="text-sm text-destructive">Revisa los datos de valoración: hay campos inválidos.</p>}

        {libroSeleccionado === "Tributario" && (
          <div className="space-y-4 border-t border-input pt-4">
            <p className="text-sm font-medium">Régimen tributario (art. 31 LIR)</p>
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="regimenDepreciacion">Régimen</Label>
              <Select
                value={regimenSeleccionado}
                onValueChange={(v) => cambiarRegimen(v as FormValues["valoraciones"][number]["regimenDepreciacion"])}
              >
                <SelectTrigger id="regimenDepreciacion" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVO_FIJO_REGIMEN_DEPRECIACION.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "Instantanea" ? "Instantánea (Pro Pyme)" : r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {regimenSeleccionado === "Acelerada" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vidaUtilNormalMeses">Vida útil normal SII (meses)</Label>
                  <Input
                    id="vidaUtilNormalMeses"
                    type="number"
                    min={1}
                    {...register("valoraciones.0.vidaUtilNormalMeses", {
                      valueAsNumber: true,
                      onChange: (e) => {
                        const meses = Number(e.target.value);
                        if (meses > 0) setValue("valoraciones.0.vidaUtilMeses", Math.max(12, Math.round(meses / 3)));
                      },
                    })}
                  />
                  {vidasUtilesSii.length > 0 && (
                    <Select onValueChange={(id) => {
                      const fila = vidasUtilesSii.find((v) => v.id === id);
                      if (fila) elegirVidaUtilSii(fila.vidaUtilNormalMeses);
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Buscar en la tabla SII..." />
                      </SelectTrigger>
                      <SelectContent>
                        {vidasUtilesSii.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.categoria} ({v.vidaUtilNormalMeses} meses)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Vida útil acelerada (÷3, calculada)</Label>
                  <Input value={watch("valoraciones.0.vidaUtilMeses") || ""} disabled />
                </div>
              </div>
            )}
            {regimenSeleccionado === "Instantanea" && (
              <p className="text-xs text-muted-foreground">
                Deprecia el 100% del costo en el primer mes elegible. Solo corresponde si la empresa está acogida al
                régimen Pro Pyme (14 D N°3/N°8) y el activo es nuevo — confírmalo antes de usarlo.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : activo ? "Guardar cambios" : "Crear activo"}
        </Button>
      </div>
    </form>
  );
}
