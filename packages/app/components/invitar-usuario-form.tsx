"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { invitarUsuarioSchema } from "@erp/shared";
import type { z } from "zod";
import { invitarUsuarioAction } from "@/lib/actions/usuarios";
import { AsignacionesEmpresas } from "@/components/asignaciones-empresas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkGenerado } from "@/components/link-generado";

type Opcion = { id: string; label: string };

type FormValues = z.input<typeof invitarUsuarioSchema>;

export function InvitarUsuarioForm({ empresas }: { empresas: Opcion[] }) {
  const [isPending, startTransition] = useTransition();
  const [invitacion, setInvitacion] = useState<{ email: string; token: string | null } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(invitarUsuarioSchema),
    defaultValues: {
      nombre: "",
      email: "",
      esAdminFirma: false,
      empresas: [],
    } satisfies FormValues,
  });

  const esAdminFirma = watch("esAdminFirma");

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await invitarUsuarioAction(data);
      if (result.ok) {
        toast.success(result.yaTeniaCuenta ? "Se le dio acceso a esta firma" : `Usuario "${data.nombre}" invitado`);
        setInvitacion({ email: data.email.trim().toLowerCase(), token: result.token });
        reset();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...register("nombre")} />
            {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" {...register("esAdminFirma")} />
          Administrador de la firma (gestiona usuarios y los datos de la firma)
        </label>
        <p className="text-xs text-muted-foreground">
          Si el email ya tiene una cuenta activa en otra firma, se le da acceso a esta con esa misma cuenta (un solo email y contraseña para varias firmas).
        </p>

        <AsignacionesEmpresas
          empresas={empresas}
          value={watch("empresas")}
          onChange={(v) => setValue("empresas", v, { shouldValidate: true })}
          esAdminFirma={!!esAdminFirma}
          error={typeof errors.empresas?.message === "string" ? errors.empresas.message : undefined}
        />

        <Button type="submit" disabled={isPending}>
          {isPending ? "Invitando..." : "Invitar"}
        </Button>
      </form>

      {invitacion?.token && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Invitación para {invitacion.email}:</p>
          <LinkGenerado token={invitacion.token} />
        </div>
      )}
      {invitacion && !invitacion.token && (
        <p className="rounded-md border bg-muted/50 p-4 text-sm">
          <span className="font-medium">{invitacion.email}</span> ya tenía una cuenta: ahora también tiene acceso a esta firma. Inicia sesión con su email y
          contraseña de siempre, y elige esta firma; no hay link que enviar.
        </p>
      )}
    </div>
  );
}
