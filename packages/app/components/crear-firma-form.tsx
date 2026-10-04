"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { PLAN_CONTRATADO, crearFirmaConAdminSchema } from "@erp/shared";
import type { z } from "zod";
import { crearFirmaConAdminAction } from "@/lib/actions/firmas";
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
import { LinkGenerado } from "@/components/link-generado";

type FormValues = z.input<typeof crearFirmaConAdminSchema>;

export function CrearFirmaForm({ onCreated }: { onCreated?: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{ token: string | null; yaTeniaCuenta: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(crearFirmaConAdminSchema),
    defaultValues: {
      firma: { rut: "", razonSocial: "", planContratado: "Basico", estado: "Activa" },
      admin: { nombre: "", email: "" },
    } satisfies FormValues,
  });
  const planContratado = useWatch({ control, name: "firma.planContratado" });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await crearFirmaConAdminAction(data);
      if (result.ok) {
        toast.success(`Firma "${data.firma.razonSocial}" creada`);
        setResultado({ token: result.token, yaTeniaCuenta: result.yaTeniaCuenta });
        reset();
        onCreated?.();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm font-medium">Datos de la firma</p>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="space-y-2">
            <Label htmlFor="rut">RUT</Label>
            <Input id="rut" placeholder="76.123.456-7" {...register("firma.rut")} />
            {errors.firma?.rut && (
              <p className="text-sm text-destructive">{errors.firma.rut.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="razonSocial">Razón social</Label>
            <Input id="razonSocial" {...register("firma.razonSocial")} />
            {errors.firma?.razonSocial && (
              <p className="text-sm text-destructive">{errors.firma.razonSocial.message}</p>
            )}
          </div>
        </div>
        <div className="space-y-2 sm:max-w-xs">
          <Label htmlFor="planContratado">Plan contratado</Label>
          <Select
            value={planContratado}
            onValueChange={(v) => setValue("firma.planContratado", v as FormValues["firma"]["planContratado"])}
          >
            <SelectTrigger id="planContratado" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_CONTRATADO.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4 border-t pt-4">
        <p className="text-sm font-medium">Primer Administrador de la firma</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="adminNombre">Nombre</Label>
            <Input id="adminNombre" {...register("admin.nombre")} />
            {errors.admin?.nombre && (
              <p className="text-sm text-destructive">{errors.admin.nombre.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminEmail">Email</Label>
            <Input id="adminEmail" type="email" {...register("admin.email")} />
            {errors.admin?.email && (
              <p className="text-sm text-destructive">{errors.admin.email.message}</p>
            )}
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creando la firma y su base… (puede tardar un minuto)" : "Crear firma"}
      </Button>

      {resultado?.token && <LinkGenerado token={resultado.token} />}
      {resultado && !resultado.token && (
        <p className="rounded-md border bg-muted/50 p-4 text-sm">
          Ese administrador ya tenía una cuenta: ahora también administra esta firma. Entra con su email y contraseña de siempre y elige la firma; no hay link que enviar.
        </p>
      )}
    </form>
  );
}
