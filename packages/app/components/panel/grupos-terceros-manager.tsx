"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { crearGrupoTerceroSchema } from "@erp/shared";
import {
  crearGrupoTerceroAction,
  editarGrupoTerceroAction,
  eliminarGrupoTerceroAction,
} from "@/lib/actions/terceros-grupos";
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
import { IrACuenta } from "./ir-a-cuenta";

export type Opcion = { id: string; label: string };
export type GrupoLite = {
  id: string;
  codigo: string;
  nombre: string;
  cuentaContableAsociadaId: string | null;
  categoriaContableDefaultId: string | null;
};
type FormValues = z.input<typeof crearGrupoTerceroSchema>;
const NINGUNA = "__none__";

function valoresDe(g: GrupoLite | null): FormValues {
  return {
    codigo: g?.codigo ?? "",
    nombre: g?.nombre ?? "",
    cuentaContableAsociadaId: g?.cuentaContableAsociadaId ?? undefined,
    categoriaContableDefaultId: g?.categoriaContableDefaultId ?? undefined,
  };
}

export function GruposTercerosManager({
  empresaId,
  grupos,
  cuentas,
  categorias,
}: {
  empresaId: string;
  grupos: GrupoLite[];
  cuentas: Opcion[];
  categorias: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [edicion, setEdicion] = useState<GrupoLite | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(crearGrupoTerceroSchema),
    defaultValues: valoresDe(null),
  });

  useEffect(() => {
    if (abierto) reset(valoresDe(edicion));
  }, [abierto, edicion, reset]);

  const nom = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of [...cuentas, ...categorias]) m.set(o.id, o.label);
    return m;
  }, [cuentas, categorias]);

  const sel = (
    name: "cuentaContableAsociadaId" | "categoriaContableDefaultId",
    label: string,
    opciones: Opcion[],
    placeholder: string,
    esCuenta = false,
  ) => {
    const valor = watch(name) as string | undefined;
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <Select
            value={valor ?? NINGUNA}
            onValueChange={(v) => setValue(name, (v === NINGUNA ? undefined : v) as never)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA}>{placeholder}</SelectItem>
              {opciones.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {esCuenta && <IrACuenta empresaId={empresaId} cuentaId={valor} />}
        </div>
      </div>
    );
  };

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = edicion
        ? await editarGrupoTerceroAction(empresaId, edicion.id, data)
        : await crearGrupoTerceroAction(empresaId, data);
      if (r.ok) {
        toast.success(edicion ? "Grupo actualizado" : "Grupo creado");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  });

  function borrar(g: GrupoLite) {
    if (!confirm(`¿Eliminar el grupo ${g.codigo}?`)) return;
    startTransition(async () => {
      const r = await eliminarGrupoTerceroAction(empresaId, g.id);
      if (r.ok) {
        toast.success("Grupo eliminado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEdicion(null);
            setAbierto(true);
          }}
        >
          Nuevo grupo
        </Button>
      </div>

      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta empresa no tiene grupos de socios.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Cuenta puente</TableHead>
                <TableHead>Categoría contable</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono font-medium">{g.codigo}</TableCell>
                  <TableCell>{g.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {g.cuentaContableAsociadaId ? (nom.get(g.cuentaContableAsociadaId) ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {g.categoriaContableDefaultId ? (nom.get(g.categoriaContableDefaultId) ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEdicion(g);
                        setAbierto(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => borrar(g)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edicion ? "Editar grupo" : "Nuevo grupo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="g-codigo">Código</Label>
                <Input id="g-codigo" {...register("codigo")} />
                {errors.codigo && (
                  <p className="text-sm text-destructive">{errors.codigo.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-nombre">Nombre</Label>
                <Input id="g-nombre" {...register("nombre")} />
                {errors.nombre && (
                  <p className="text-sm text-destructive">{errors.nombre.message}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Se usan cuando un socio del grupo no tiene su propia cuenta/categoría asignada, antes
              de caer al fallback GENERAL de Determinación de cuentas.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {sel("cuentaContableAsociadaId", "Cuenta puente por defecto", cuentas, "Sin cuenta", true)}
              {sel("categoriaContableDefaultId", "Categoría contable por defecto", categorias, "Sin categoría")}
            </div>
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
    </div>
  );
}
