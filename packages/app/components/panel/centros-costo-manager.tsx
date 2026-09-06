"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { crearCentroCostoSchema } from "@erp/shared";
import {
  crearCentroCostoAction,
  editarCentroCostoAction,
} from "@/lib/actions/centros-costo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export type CentroCostoLite = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  centroPadreId: string | null;
};

type FormValues = z.input<typeof crearCentroCostoSchema>;
const SIN_PADRE = "__none__";

export function CentrosCostoManager({
  empresaId,
  centros,
}: {
  empresaId: string;
  centros: CentroCostoLite[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<CentroCostoLite | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(crearCentroCostoSchema),
    defaultValues: valoresDe(null),
  });

  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion));
  }, [abierto, enEdicion, reset]);

  const nombrePorId = useMemo(
    () => new Map(centros.map((c) => [c.id, `${c.codigo} — ${c.nombre}`])),
    [centros],
  );

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = enEdicion
        ? await editarCentroCostoAction(empresaId, enEdicion.id, data)
        : await crearCentroCostoAction(empresaId, data);
      if (result.ok) {
        toast.success(enEdicion ? "Centro de costo actualizado" : "Centro de costo creado");
        setAbierto(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEnEdicion(null);
            setAbierto(true);
          }}
        >
          Nuevo centro de costo
        </Button>
      </div>

      {centros.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta empresa no tiene centros de costo.
        </p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Depende de</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centros.map((centro) => (
                <TableRow key={centro.id}>
                  <TableCell className="font-mono text-muted-foreground">{centro.codigo}</TableCell>
                  <TableCell>{centro.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {centro.centroPadreId ? nombrePorId.get(centro.centroPadreId) ?? "—" : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={centro.estado === "Activo" ? "default" : "secondary"}>
                      {centro.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEnEdicion(centro);
                        setAbierto(true);
                      }}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {enEdicion ? "Editar centro de costo" : "Nuevo centro de costo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" {...register("codigo")} />
                {errors.codigo && (
                  <p className="text-sm text-destructive">{errors.codigo.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" {...register("nombre")} />
                {errors.nombre && (
                  <p className="text-sm text-destructive">{errors.nombre.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="centroPadreId">Depende de (opcional)</Label>
              <Select
                value={watch("centroPadreId") ?? SIN_PADRE}
                onValueChange={(value) =>
                  setValue("centroPadreId", value === SIN_PADRE ? undefined : value)
                }
              >
                <SelectTrigger id="centroPadreId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_PADRE}>Sin centro padre</SelectItem>
                  {centros
                    .filter((c) => c.id !== enEdicion?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} — {c.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="estado">Estado</Label>
              <Select
                value={watch("estado")}
                onValueChange={(value) => setValue("estado", value as FormValues["estado"])}
              >
                <SelectTrigger id="estado" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : enEdicion ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function valoresDe(centro: CentroCostoLite | null): FormValues {
  return {
    codigo: centro?.codigo ?? "",
    nombre: centro?.nombre ?? "",
    centroPadreId: centro?.centroPadreId ?? undefined,
    estado: (centro?.estado as FormValues["estado"]) ?? "Activo",
  };
}
