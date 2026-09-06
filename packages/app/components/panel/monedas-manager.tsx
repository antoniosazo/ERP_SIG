"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { MONEDA_TIPO, crearMonedaSchema } from "@erp/shared";
import {
  crearMonedaAction,
  editarMonedaAction,
  eliminarMonedaAction,
} from "@/lib/actions/monedas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export type MonedaLite = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  simbolo: string;
  decimales: number;
  codigoIso: string | null;
};

type FormValues = z.input<typeof crearMonedaSchema>;

export function MonedasManager({
  empresaId,
  monedas,
  bloqueado = false,
}: {
  empresaId: string;
  monedas: MonedaLite[];
  /** La empresa ya tiene transacciones: las monedas existentes no se editan ni eliminan. */
  bloqueado?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<MonedaLite | null>(null);
  const [aEliminar, setAEliminar] = useState<MonedaLite | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearMonedaSchema),
    defaultValues: valoresDe(null),
  });

  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion));
  }, [abierto, enEdicion, reset]);

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = enEdicion
        ? await editarMonedaAction(empresaId, enEdicion.id, data)
        : await crearMonedaAction(empresaId, data);
      if (result.ok) {
        toast.success(enEdicion ? "Moneda actualizada" : "Moneda creada");
        setAbierto(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  });

  function confirmarEliminar() {
    if (!aEliminar) return;
    startTransition(async () => {
      const result = await eliminarMonedaAction(empresaId, aEliminar.id);
      if (result.ok) {
        toast.success(`Moneda ${aEliminar.codigo} eliminada`);
        setAEliminar(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {bloqueado && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          Esta empresa ya tiene transacciones contables: las monedas existentes no se
          pueden modificar ni eliminar. Sí puedes agregar monedas nuevas.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEnEdicion(null);
            setAbierto(true);
          }}
        >
          Nueva moneda
        </Button>
      </div>

      {monedas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta empresa no tiene monedas.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Símbolo</TableHead>
                <TableHead>Decimales</TableHead>
                <TableHead>Código ISO</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monedas.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono font-medium">{m.codigo}</TableCell>
                  <TableCell>{m.nombre}</TableCell>
                  <TableCell>
                    <Badge variant={m.tipo === "Moneda" ? "default" : "secondary"}>{m.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.simbolo}</TableCell>
                  <TableCell className="text-muted-foreground">{m.decimales}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {m.codigoIso ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={bloqueado}
                      title={bloqueado ? "Bloqueado: la empresa tiene transacciones" : undefined}
                      onClick={() => {
                        setEnEdicion(m);
                        setAbierto(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={bloqueado}
                      title={bloqueado ? "Bloqueado: la empresa tiene transacciones" : undefined}
                      onClick={() => setAEliminar(m)}
                    >
                      Eliminar
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
            <DialogTitle>{enEdicion ? "Editar moneda" : "Nueva moneda"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" {...register("codigo")} placeholder="CLP" />
                {errors.codigo && (
                  <p className="text-sm text-destructive">{errors.codigo.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" {...register("nombre")} placeholder="Peso Chileno" />
                {errors.nombre && (
                  <p className="text-sm text-destructive">{errors.nombre.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={watch("tipo")}
                  onValueChange={(v) => setValue("tipo", v as FormValues["tipo"])}
                >
                  <SelectTrigger id="tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONEDA_TIPO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="simbolo">Símbolo</Label>
                <Input id="simbolo" {...register("simbolo")} placeholder="$" />
                {errors.simbolo && (
                  <p className="text-sm text-destructive">{errors.simbolo.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="decimales">Decimales</Label>
                <Input
                  id="decimales"
                  type="number"
                  min={0}
                  max={8}
                  {...register("decimales", { valueAsNumber: true })}
                />
                {errors.decimales && (
                  <p className="text-sm text-destructive">{errors.decimales.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="codigoIso">Código ISO 4217 (opcional)</Label>
              <Input
                id="codigoIso"
                placeholder="CLP"
                {...register("codigoIso", {
                  setValueAs: (v) =>
                    v === "" || v == null ? undefined : String(v).toUpperCase(),
                })}
              />
              {errors.codigoIso && (
                <p className="text-sm text-destructive">{errors.codigoIso.message}</p>
              )}
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

      <Dialog open={aEliminar !== null} onOpenChange={(o) => !o && setAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar moneda</DialogTitle>
            <DialogDescription>
              ¿Eliminar {aEliminar?.codigo} — {aEliminar?.nombre}? No se puede si está en uso
              por la empresa o por asientos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAEliminar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={confirmarEliminar}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function valoresDe(m: MonedaLite | null): FormValues {
  return {
    codigo: m?.codigo ?? "",
    nombre: m?.nombre ?? "",
    tipo: (m?.tipo as FormValues["tipo"]) ?? MONEDA_TIPO[0],
    simbolo: m?.simbolo ?? "",
    decimales: m?.decimales ?? 2,
    codigoIso: m?.codigoIso ?? undefined,
  };
}
