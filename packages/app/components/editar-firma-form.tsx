"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FIRMA_ESTADO, PLAN_CONTRATADO, actualizarFirmaContableSchema } from "@erp/shared";
import type { z } from "zod";
import { actualizarFirmaContableAction } from "@/lib/actions/firmas";
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

export function EditarFirmaForm({ valoresIniciales }: { valoresIniciales: FormValues }) {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(actualizarFirmaContableSchema),
    defaultValues: valoresIniciales,
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await actualizarFirmaContableAction(data);
      if (result.ok) {
        toast.success("Firma actualizada");
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="razonSocial">Razón social</Label>
        <Input id="razonSocial" {...register("razonSocial")} />
        {errors.razonSocial && (
          <p className="text-sm text-destructive">{errors.razonSocial.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="planContratado">Plan contratado</Label>
          <Select
            value={watch("planContratado")}
            onValueChange={(value) => setValue("planContratado", value as FormValues["planContratado"])}
          >
            <SelectTrigger id="planContratado" className="w-full">
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
          <Label htmlFor="estado">Estado</Label>
          <Select
            value={watch("estado")}
            onValueChange={(value) => setValue("estado", value as FormValues["estado"])}
          >
            <SelectTrigger id="estado" className="w-full">
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

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
