"use client";

import { useId, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { FIRMA_ESTADO, PLAN_CONTRATADO, actualizarFirmaContableSchema } from "@erp/shared";
import type { z } from "zod";
import { actualizarFirmaContableAction, actualizarFirmaSuperAdminAction } from "@/lib/actions/firmas";
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

type FormValues = z.input<typeof actualizarFirmaContableSchema>;

export function EditarFirmaForm({
  valoresIniciales,
  firmaId,
  onSaved,
}: {
  valoresIniciales: FormValues;
  firmaId?: string;
  onSaved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const id = useId();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(actualizarFirmaContableSchema),
    defaultValues: valoresIniciales,
  });
  const planContratado = useWatch({ control, name: "planContratado" });
  const estado = useWatch({ control, name: "estado" });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = firmaId
        ? await actualizarFirmaSuperAdminAction(firmaId, data)
        : await actualizarFirmaContableAction({ razonSocial: data.razonSocial });
      if (result.ok) {
        toast.success("Firma actualizada");
        onSaved?.();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-razonSocial`}>Razón social</Label>
        <Input id={`${id}-razonSocial`} {...register("razonSocial")} />
        {errors.razonSocial && (
          <p className="text-sm text-destructive">{errors.razonSocial.message}</p>
        )}
      </div>

      {firmaId && (
        <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${id}-planContratado`}>Plan contratado</Label>
          <Select
            value={planContratado}
            onValueChange={(value) => setValue("planContratado", value as FormValues["planContratado"])}
          >
            <SelectTrigger id={`${id}-planContratado`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_CONTRATADO.map((plan) => (
                <SelectItem key={plan} value={plan}>
                  {plan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${id}-estado`}>Estado</Label>
          <Select
            value={estado}
            onValueChange={(value) => setValue("estado", value as FormValues["estado"])}
          >
            <SelectTrigger id={`${id}-estado`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIRMA_ESTADO.map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {estado}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        </div>
      )}

      {firmaId && estado === "Suspendida" && (
        <p className="text-sm text-destructive">
          La suspensión bloquea nuevos accesos. Las sesiones abiertas se revisan en un plazo de hasta 5 minutos.
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
