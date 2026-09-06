"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ROL, invitarUsuarioSchema } from "@erp/shared";
import type { z } from "zod";
import { invitarUsuarioAction } from "@/lib/actions/usuarios";
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

type Opcion = { id: string; label: string };

type FormValues = z.input<typeof invitarUsuarioSchema>;

export function InvitarUsuarioForm({ empresas }: { empresas: Opcion[] }) {
  const [isPending, startTransition] = useTransition();
  const [tokenGenerado, setTokenGenerado] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
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

  const { fields, append, remove } = useFieldArray({ control, name: "empresas" });
  const esAdminFirma = watch("esAdminFirma");

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await invitarUsuarioAction(data);
      if (result.ok) {
        toast.success(`Usuario "${data.nombre}" invitado`);
        setTokenGenerado(result.token);
        reset();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Empresas asignadas y rol en cada una</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ empresaId: empresas[0]?.id ?? "", rol: "Contador" })}
              disabled={empresas.length === 0}
            >
              Agregar empresa
            </Button>
          </div>

          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {esAdminFirma
                ? "Sin empresas asignadas (opcional para un Administrador de firma)."
                : "Agrega al menos una empresa."}
            </p>
          )}

          {fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select
                  value={watch(`empresas.${index}.empresaId`)}
                  onValueChange={(value) => setValue(`empresas.${index}.empresaId`, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40 space-y-1">
                <Label className="text-xs text-muted-foreground">Rol</Label>
                <Select
                  value={watch(`empresas.${index}.rol`)}
                  onValueChange={(value) =>
                    setValue(`empresas.${index}.rol`, value as FormValues["empresas"][number]["rol"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROL.map((rol) => (
                      <SelectItem key={rol} value={rol}>
                        {rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                Quitar
              </Button>
            </div>
          ))}
          {errors.empresas && typeof errors.empresas.message === "string" && (
            <p className="text-sm text-destructive">{errors.empresas.message}</p>
          )}
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Invitando..." : "Invitar"}
        </Button>
      </form>

      {tokenGenerado && <LinkGenerado token={tokenGenerado} />}
    </div>
  );
}
