"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { crearContactoSchema } from "@erp/shared";
import {
  crearContactoAction,
  editarContactoAction,
  eliminarContactoAction,
} from "@/lib/actions/terceros";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ContactoLite = {
  id: string;
  nombre: string;
  apellido: string | null;
  cargo: string | null;
  telefono: string | null;
  movil: string | null;
  email: string | null;
  activo: boolean;
};
type FormValues = z.input<typeof crearContactoSchema>;

const vacio: FormValues = {
  nombre: "", apellido: "", cargo: "", telefono: "", movil: "", email: "", activo: true,
};

export function TerceroContactos({
  empresaId,
  terceroId,
  contactos,
}: {
  empresaId: string;
  terceroId: string;
  contactos: ContactoLite[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [edicion, setEdicion] = useState<ContactoLite | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearContactoSchema),
    defaultValues: vacio,
  });

  useEffect(() => {
    if (abierto) reset(edicion ? { ...vacio, ...clean(edicion) } : vacio);
  }, [abierto, edicion, reset]);

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = edicion
        ? await editarContactoAction(empresaId, terceroId, edicion.id, data)
        : await crearContactoAction(empresaId, terceroId, data);
      if (r.ok) {
        toast.success(edicion ? "Contacto actualizado" : "Contacto agregado");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  });

  function borrar(c: ContactoLite) {
    if (!confirm(`¿Eliminar el contacto ${c.nombre}?`)) return;
    startTransition(async () => {
      const r = await eliminarContactoAction(empresaId, terceroId, c.id);
      if (r.ok) {
        toast.success("Contacto eliminado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Contactos</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEdicion(null);
            setAbierto(true);
          }}
        >
          Agregar
        </Button>
      </CardHeader>
      {contactos.length === 0 ? (
        <p className="px-6 pb-2 text-sm text-muted-foreground">Sin contactos.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Teléfono / Móvil</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contactos.map((c) => (
              <TableRow key={c.id} className={c.activo ? undefined : "opacity-50"}>
                <TableCell>
                  {c.nombre} {c.apellido}
                  {!c.activo && (
                    <Badge variant="secondary" className="ml-2">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.cargo ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {[c.telefono, c.movil].filter(Boolean).join(" / ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEdicion(c);
                      setAbierto(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => borrar(c)}
                  >
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edicion ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-nombre">Nombre</Label>
                <Input id="c-nombre" {...register("nombre")} />
                {errors.nombre && (
                  <p className="text-sm text-destructive">{errors.nombre.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-apellido">Apellido</Label>
                <Input id="c-apellido" {...register("apellido")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-cargo">Cargo</Label>
                <Input id="c-cargo" {...register("cargo")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-email">Email</Label>
                <Input id="c-email" {...register("email")} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-telefono">Teléfono</Label>
                <Input id="c-telefono" {...register("telefono")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-movil">Móvil</Label>
                <Input id="c-movil" {...register("movil")} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("activo")} /> Activo
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function clean(c: ContactoLite): FormValues {
  return {
    nombre: c.nombre,
    apellido: c.apellido ?? "",
    cargo: c.cargo ?? "",
    telefono: c.telefono ?? "",
    movil: c.movil ?? "",
    email: c.email ?? "",
    activo: c.activo,
  };
}
