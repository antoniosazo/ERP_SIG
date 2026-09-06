"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { DIRECCION_TIPO, crearDireccionSchema } from "@erp/shared";
import {
  crearDireccionAction,
  editarDireccionAction,
  eliminarDireccionAction,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DireccionLite = {
  id: string;
  tipo: string;
  nombre: string | null;
  calle: string | null;
  numero: string | null;
  comuna: string | null;
  ciudad: string | null;
  region: string | null;
  pais: string;
  codigoPostal: string | null;
  esPrincipal: boolean;
};
type FormValues = z.input<typeof crearDireccionSchema>;

const vacio: FormValues = {
  tipo: DIRECCION_TIPO[0], nombre: "", calle: "", numero: "", comuna: "", ciudad: "",
  region: "", pais: "Chile", codigoPostal: "", esPrincipal: false,
};

export function TerceroDirecciones({
  empresaId,
  terceroId,
  direcciones,
}: {
  empresaId: string;
  terceroId: string;
  direcciones: DireccionLite[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [edicion, setEdicion] = useState<DireccionLite | null>(null);
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearDireccionSchema),
    defaultValues: vacio,
  });

  useEffect(() => {
    if (abierto) reset(edicion ? clean(edicion) : vacio);
  }, [abierto, edicion, reset]);

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = edicion
        ? await editarDireccionAction(empresaId, terceroId, edicion.id, data)
        : await crearDireccionAction(empresaId, terceroId, data);
      if (r.ok) {
        toast.success(edicion ? "Dirección actualizada" : "Dirección agregada");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  });

  function borrar(d: DireccionLite) {
    if (!confirm("¿Eliminar esta dirección?")) return;
    startTransition(async () => {
      const r = await eliminarDireccionAction(empresaId, terceroId, d.id);
      if (r.ok) {
        toast.success("Dirección eliminada");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Direcciones</CardTitle>
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
      {direcciones.length === 0 ? (
        <p className="px-6 pb-2 text-sm text-muted-foreground">Sin direcciones.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Comuna / Ciudad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {direcciones.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  {d.tipo}
                  {d.esPrincipal && (
                    <Badge className="ml-2">Principal</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {[d.calle, d.numero].filter(Boolean).join(" ") || d.nombre || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {[d.comuna, d.ciudad].filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEdicion(d);
                      setAbierto(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => borrar(d)}
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
            <DialogTitle>{edicion ? "Editar dirección" : "Nueva dirección"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="d-tipo">Tipo</Label>
                <Select
                  value={watch("tipo")}
                  onValueChange={(v) => setValue("tipo", v as FormValues["tipo"])}
                >
                  <SelectTrigger id="d-tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECCION_TIPO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-nombre">Alias</Label>
                <Input id="d-nombre" {...register("nombre")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-calle">Calle</Label>
                <Input id="d-calle" {...register("calle")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-numero">Número</Label>
                <Input id="d-numero" {...register("numero")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-comuna">Comuna</Label>
                <Input id="d-comuna" {...register("comuna")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-ciudad">Ciudad</Label>
                <Input id="d-ciudad" {...register("ciudad")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-region">Región</Label>
                <Input id="d-region" {...register("region")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-pais">País</Label>
                <Input id="d-pais" {...register("pais")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-cp">Código postal</Label>
                <Input id="d-cp" {...register("codigoPostal")} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("esPrincipal")} /> Principal
              para este tipo
            </label>
            {errors.tipo && <p className="text-sm text-destructive">{errors.tipo.message}</p>}
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

function clean(d: DireccionLite): FormValues {
  return {
    tipo: d.tipo as FormValues["tipo"],
    nombre: d.nombre ?? "",
    calle: d.calle ?? "",
    numero: d.numero ?? "",
    comuna: d.comuna ?? "",
    ciudad: d.ciudad ?? "",
    region: d.region ?? "",
    pais: d.pais,
    codigoPostal: d.codigoPostal ?? "",
    esPrincipal: d.esPrincipal,
  };
}
