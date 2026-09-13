"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { TIPO_TERCERO, crearTerceroSchema, formatearRut } from "@erp/shared";
import { crearTerceroAction } from "@/lib/actions/terceros";
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
import { FilaGrupo, useAgrupado, useExpandidos } from "./tabla-agrupada";

export type TerceroFila = {
  id: string;
  codigo: string | null;
  rut: string;
  razonSocial: string;
  tipoTercero: string;
  grupoId: string | null;
  activo: boolean;
  bloqueado: boolean;
};

type FormValues = z.input<typeof crearTerceroSchema>;

export function TercerosManager({
  empresaId,
  terceros,
  grupos,
}: {
  empresaId: string;
  terceros: TerceroFila[];
  grupos: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const grupoLabel = new Map(grupos.map((g) => [g.id, g.label]));
  const porTipo = useAgrupado(terceros, (t) => t.tipoTercero);
  const { expandidos: tiposAbiertos, alternar: alternarTipo } = useExpandidos();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearTerceroSchema),
    defaultValues: { rut: "", razonSocial: "", tipoTercero: TIPO_TERCERO[0] } satisfies FormValues,
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = await crearTerceroAction(empresaId, data);
      if (r.ok) {
        toast.success("Tercero creado");
        setAbierto(false);
        reset({ rut: "", razonSocial: "", tipoTercero: TIPO_TERCERO[0] });
        router.push(`/panel/${empresaId}/maestros/terceros/${r.terceroId}`);
      } else {
        toast.error(r.error);
      }
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAbierto(true)}>Nuevo tercero</Button>
      </div>

      {terceros.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta empresa no tiene terceros.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Razón social</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...porTipo.entries()].map(([tipo, items]) => {
                const abierto = tiposAbiertos.has(tipo);
                return (
                  <Fragment key={tipo}>
                    <FilaGrupo abierto={abierto} onToggle={() => alternarTipo(tipo)} colSpan={5}>
                      {tipo} ({items.length})
                    </FilaGrupo>
                    {abierto &&
                      items.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono font-medium">
                            <Link
                              href={`/panel/${empresaId}/maestros/terceros/${t.id}`}
                              className="hover:underline"
                            >
                              {t.codigo ?? "—"}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/panel/${empresaId}/maestros/terceros/${t.id}`}
                              className="hover:underline"
                            >
                              {t.razonSocial}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {formatearRut(t.rut)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {t.grupoId ? grupoLabel.get(t.grupoId) ?? "—" : "—"}
                          </TableCell>
                          <TableCell>
                            {t.bloqueado ? (
                              <Badge variant="destructive">Bloqueado</Badge>
                            ) : t.activo ? (
                              <Badge>Activo</Badge>
                            ) : (
                              <Badge variant="secondary">Inactivo</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo tercero</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="rut">RUT</Label>
                <Input id="rut" placeholder="76.123.456-7" {...register("rut")} />
                {errors.rut && <p className="text-sm text-destructive">{errors.rut.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="razonSocial">Razón social</Label>
                <Input id="razonSocial" {...register("razonSocial")} />
                {errors.razonSocial && (
                  <p className="text-sm text-destructive">{errors.razonSocial.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="tipoTercero">Tipo</Label>
              <Select
                value={watch("tipoTercero")}
                onValueChange={(v) => setValue("tipoTercero", v as FormValues["tipoTercero"])}
              >
                <SelectTrigger id="tipoTercero" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_TERCERO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              El código se asigna automáticamente. El resto de los datos se completan en el
              detalle.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creando..." : "Crear y abrir"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
