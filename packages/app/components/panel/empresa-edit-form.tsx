"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { editarEmpresaSchema, EMPRESA_ESTADO } from "@erp/shared";
import { editarEmpresaAction } from "@/lib/actions/empresas";
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
type FormValues = z.input<typeof editarEmpresaSchema>;

export function EmpresaEditForm({
  empresaId,
  monedas,
  valoresIniciales,
  monedaFuncionalBloqueada = false,
}: {
  empresaId: string;
  monedas: Opcion[];
  valoresIniciales: FormValues;
  /** La empresa ya tiene transacciones: no se puede cambiar la moneda funcional. */
  monedaFuncionalBloqueada?: boolean;
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
    resolver: zodResolver(editarEmpresaSchema),
    defaultValues: valoresIniciales,
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await editarEmpresaAction(empresaId, data);
      if (result.ok) {
        toast.success("Datos de la empresa actualizados");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Datos generales</h2>

        <div className="grid gap-4 @xl:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="razonSocial">Razón social</Label>
            <Input id="razonSocial" {...register("razonSocial")} />
            {errors.razonSocial && (
              <p className="text-sm text-destructive">{errors.razonSocial.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="giro">Giro</Label>
            <Input id="giro" {...register("giro")} />
            {errors.giro && <p className="text-sm text-destructive">{errors.giro.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 @xl:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="regimenTributario">Régimen tributario</Label>
            <Input id="regimenTributario" {...register("regimenTributario")} />
            {errors.regimenTributario && (
              <p className="text-sm text-destructive">{errors.regimenTributario.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaInicioActividades">Fecha de inicio de actividades</Label>
            <Input id="fechaInicioActividades" type="date" {...register("fechaInicioActividades")} />
            {errors.fechaInicioActividades && (
              <p className="text-sm text-destructive">{errors.fechaInicioActividades.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="direccion">Dirección (opcional)</Label>
          <Input id="direccion" {...register("direccion")} />
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-medium text-muted-foreground">Monedas y NIIF</h2>

        <div className="grid gap-4 @xl:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="monedaFuncionalId">Moneda funcional</Label>
            <Select
              value={watch("monedaFuncionalId")}
              onValueChange={(value) => setValue("monedaFuncionalId", value)}
              disabled={monedaFuncionalBloqueada}
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
            {monedaFuncionalBloqueada ? (
              <p className="text-xs text-muted-foreground">
                Bloqueada: la empresa ya tiene transacciones contables.
              </p>
            ) : (
              errors.monedaFuncionalId && (
                <p className="text-sm text-destructive">{errors.monedaFuncionalId.message}</p>
              )
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

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("permiteMultimoneda")} className="size-4" />
            Admite multi-moneda
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("aplicaIfrs")} className="size-4" />
            Aplica IFRS (doble libro)
          </label>
        </div>

        <div className="space-y-2 @xl:max-w-xs">
          <Label htmlFor="estado">Estado</Label>
          <Select value={watch("estado")} onValueChange={(value) => setValue("estado", value as FormValues["estado"])}>
            <SelectTrigger id="estado" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMPRESA_ESTADO.map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {estado}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
