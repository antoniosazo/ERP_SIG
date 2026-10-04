"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { editarUsuarioSchema } from "@erp/shared";
import type { z } from "zod";
import { editarUsuarioAction } from "@/lib/actions/usuarios";
import { AsignacionesEmpresas } from "@/components/asignaciones-empresas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = z.input<typeof editarUsuarioSchema>;
export type UsuarioEditable = {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  esAdminFirma: boolean;
  esSuperAdmin: boolean;
  /** En cuántas otras firmas trabaja la misma cuenta. */
  otrasFirmas: number;
  asignaciones: { empresaId: string; rol: string }[];
};

/** Edita nombre, empresas y roles de un usuario; el email solo mientras su invitación está pendiente. */
export function EditarUsuarioDialog({
  usuario,
  empresas,
  esUnoMismo,
}: {
  usuario: UsuarioEditable;
  empresas: { id: string; label: string }[];
  esUnoMismo: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Si la cuenta da acceso a otras firmas, su nombre y email no se editan desde esta.
  const compartida = usuario.otrasFirmas > 0;
  const puedeEditarEmail = usuario.estado === "Invitado" && !compartida;
  // Nadie cambia su propio nivel de administrador, y el de un superadmin no se toca desde la firma.
  const nivelBloqueado = esUnoMismo || usuario.esSuperAdmin;

  const valoresIniciales = (): FormValues => ({
    nombre: usuario.nombre,
    ...(puedeEditarEmail ? { email: usuario.email } : {}),
    esAdminFirma: usuario.esAdminFirma,
    empresas: usuario.asignaciones.map((a) => ({ empresaId: a.empresaId, rol: a.rol as FormValues["empresas"][number]["rol"] })),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(editarUsuarioSchema), defaultValues: valoresIniciales() });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = await editarUsuarioAction(usuario.id, data);
      if (r.ok) {
        toast.success("Usuario actualizado");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          reset(valoresIniciales());
          setAbierto(true);
        }}
      >
        <PencilIcon className="mr-1 size-3.5" aria-hidden /> Editar
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar a {usuario.nombre}</DialogTitle>
            <DialogDescription>Los cambios de empresas y roles rigen en pocos minutos, cuando la persona vuelva a cargar su sesión.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`nombre-${usuario.id}`}>Nombre</Label>
                <Input id={`nombre-${usuario.id}`} disabled={compartida} {...register("nombre")} />
                {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`email-${usuario.id}`}>Email</Label>
                {puedeEditarEmail ? (
                  <Input id={`email-${usuario.id}`} type="email" {...register("email")} />
                ) : (
                  <Input id={`email-${usuario.id}`} value={usuario.email} disabled readOnly />
                )}
                <p className="text-xs text-muted-foreground">
                  {compartida
                    ? "Esta persona también trabaja en otras firmas: su nombre y su email no se editan desde una firma."
                    : puedeEditarEmail
                      ? "Puedes corregirlo mientras no active su cuenta."
                      : "Es su identidad: no se cambia una vez activada la cuenta."}
                </p>
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" disabled={nivelBloqueado} {...register("esAdminFirma")} />
              Administrador de la firma (gestiona usuarios y los datos de la firma)
              {nivelBloqueado && <span className="text-xs text-muted-foreground">— no se puede cambiar aquí</span>}
            </label>

            <AsignacionesEmpresas
              empresas={empresas}
              value={watch("empresas")}
              onChange={(v) => setValue("empresas", v, { shouldValidate: true })}
              esAdminFirma={watch("esAdminFirma")}
              error={typeof errors.empresas?.message === "string" ? errors.empresas.message : undefined}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
