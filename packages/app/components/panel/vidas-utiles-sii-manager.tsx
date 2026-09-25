"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { crearVidaUtilSiiSchema } from "@erp/shared";
import { crearVidaUtilSiiAction } from "@/lib/actions/activos-fijos-tributario";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type VidaUtilSiiLite = {
  id: string;
  empresaId: string | null;
  categoria: string;
  descripcion: string | null;
  vidaUtilNormalMeses: number;
  activa: boolean;
};

type FormValues = z.input<typeof crearVidaUtilSiiSchema>;

export function VidasUtilesSiiManager({ empresaId, filas }: { empresaId: string; filas: VidaUtilSiiLite[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(crearVidaUtilSiiSchema),
    defaultValues: { categoria: "", descripcion: "", vidaUtilNormalMeses: 12, activa: true },
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await crearVidaUtilSiiAction(empresaId, data);
      if (result.ok) {
        toast.success("Categoría agregada");
        setAbierto(false);
        reset();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Subconjunto representativo de la tabla del SII (Resolución Ex. N°43/2002) más las categorías propias de esta
        firma. Verifica la vigencia con la tabla oficial antes de usarla en una declaración.
      </p>
      <div className="flex justify-end">
        <Button onClick={() => setAbierto(true)}>Agregar categoría</Button>
      </div>

      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Vida útil normal (meses)</TableHead>
              <TableHead>Origen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.categoria}</TableCell>
                <TableCell className="text-muted-foreground">{f.descripcion ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{f.vidaUtilNormalMeses}</TableCell>
                <TableCell>
                  <Badge variant={f.empresaId ? "secondary" : "default"}>{f.empresaId ? "Propia" : "Plantilla SII"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar categoría</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Input id="categoria" {...register("categoria")} />
              {errors.categoria && <p className="text-sm text-destructive">{errors.categoria.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Input id="descripcion" {...register("descripcion")} />
            </div>
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="vidaUtilNormalMeses">Vida útil normal (meses)</Label>
              <Input
                id="vidaUtilNormalMeses"
                type="number"
                min={1}
                {...register("vidaUtilNormalMeses", { valueAsNumber: true })}
              />
              {errors.vidaUtilNormalMeses && (
                <p className="text-sm text-destructive">{errors.vidaUtilNormalMeses.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
