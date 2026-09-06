"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { empresaFormSchema } from "@erp/shared";
import { crearEmpresaAction } from "@/lib/actions/empresas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Opcion = { id: string; label: string };

type EmpresaFormProps = {
  monedas: Opcion[];
  plantillas: Opcion[];
};

type FormValues = z.input<typeof empresaFormSchema>;

/** Asistente de inicialización de empresa cliente (módulo 4.9-A, Proceso 0). Solo Administrador. */
export function EmpresaForm({ monedas, plantillas }: EmpresaFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(empresaFormSchema),
    defaultValues: {
      rut: "",
      razonSocial: "",
      giro: "",
      direccion: "",
      regimenTributario: "Primera Categoría",
      fechaInicioActividades: "",
      monedaFuncionalId: monedas.find((m) => m.label.startsWith("CLP"))?.id ?? monedas[0]?.id ?? "",
      permiteMultimoneda: false,
      aplicaIfrs: false,
      planCuentasPlantillaId: plantillas[0]?.id ?? "",
      fechaPrimerPeriodoContable: "",
      estado: "Activa",
    } satisfies FormValues,
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await crearEmpresaAction(data);
      if (result.ok) {
        toast.success(`Empresa "${data.razonSocial}" creada`);
        router.push(`/admin/empresas/${result.empresaId}`);
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Datos generales</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rut">RUT</Label>
            <Input id="rut" placeholder="76.123.456-7" {...register("rut")} />
            {errors.rut && <p className="text-sm text-destructive">{errors.rut.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="razonSocial">Razón social</Label>
            <Input id="razonSocial" {...register("razonSocial")} />
            {errors.razonSocial && (
              <p className="text-sm text-destructive">{errors.razonSocial.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="giro">Giro</Label>
            <Input id="giro" placeholder="Servicios de consultoría" {...register("giro")} />
            {errors.giro && <p className="text-sm text-destructive">{errors.giro.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="regimenTributario">Régimen tributario</Label>
            <Input id="regimenTributario" {...register("regimenTributario")} />
            {errors.regimenTributario && (
              <p className="text-sm text-destructive">{errors.regimenTributario.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="direccion">Dirección (opcional)</Label>
          <Input id="direccion" {...register("direccion")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fechaInicioActividades">Fecha de inicio de actividades</Label>
          <Input
            id="fechaInicioActividades"
            type="date"
            {...register("fechaInicioActividades")}
          />
          {errors.fechaInicioActividades && (
            <p className="text-sm text-destructive">{errors.fechaInicioActividades.message}</p>
          )}
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-medium text-muted-foreground">Monedas y NIIF (4.9-A / 4.9-B)</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="monedaFuncionalId">Moneda funcional</Label>
            <Select
              value={watch("monedaFuncionalId")}
              onValueChange={(value) => setValue("monedaFuncionalId", value)}
            >
              <SelectTrigger id="monedaFuncionalId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monedas.map((moneda) => (
                  <SelectItem key={moneda.id} value={moneda.id}>
                    {moneda.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.monedaFuncionalId && (
              <p className="text-sm text-destructive">{errors.monedaFuncionalId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="monedaReporteId">Moneda de reporte (opcional)</Label>
            <Select
              value={watch("monedaReporteId") ?? "__none__"}
              onValueChange={(value) =>
                setValue("monedaReporteId", value === "__none__" ? undefined : value)
              }
            >
              <SelectTrigger id="monedaReporteId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin moneda de reporte</SelectItem>
                {monedas.map((moneda) => (
                  <SelectItem key={moneda.id} value={moneda.id}>
                    {moneda.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.monedaReporteId && (
              <p className="text-sm text-destructive">{errors.monedaReporteId.message}</p>
            )}
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("permiteMultimoneda")} className="size-4" />
            Admite multi-moneda
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("aplicaIfrs")} className="size-4" />
            Aplica IFRS (doble libro)
          </label>
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-medium text-muted-foreground">
          Plan de cuentas y primer periodo (4.9-A / 4.9-C)
        </h2>

        <div className="space-y-2">
          <Label htmlFor="planCuentasPlantillaId">Plantilla de plan de cuentas a clonar</Label>
          <Select
            value={watch("planCuentasPlantillaId")}
            onValueChange={(value) => setValue("planCuentasPlantillaId", value)}
          >
            <SelectTrigger id="planCuentasPlantillaId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plantillas.map((plantilla) => (
                <SelectItem key={plantilla.id} value={plantilla.id}>
                  {plantilla.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.planCuentasPlantillaId && (
            <p className="text-sm text-destructive">{errors.planCuentasPlantillaId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fechaPrimerPeriodoContable">Fecha del primer periodo contable</Label>
          <Input
            id="fechaPrimerPeriodoContable"
            type="date"
            {...register("fechaPrimerPeriodoContable")}
          />
          {errors.fechaPrimerPeriodoContable && (
            <p className="text-sm text-destructive">
              {errors.fechaPrimerPeriodoContable.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Se abrirá automáticamente el periodo contable del mes que contiene esta fecha.
          </p>
        </div>
      </section>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creando empresa..." : "Crear empresa e inicializar"}
      </Button>
    </form>
  );
}
