"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
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

type FilaArbol = { centro: CentroCostoLite; nivel: number; tieneHijos: boolean };

function indexarHijos(centros: CentroCostoLite[]): Map<string | null, CentroCostoLite[]> {
  const porPadre = new Map<string | null, CentroCostoLite[]>();
  for (const c of centros) {
    const arr = porPadre.get(c.centroPadreId) ?? [];
    arr.push(c);
    porPadre.set(c.centroPadreId, arr);
  }
  for (const arr of porPadre.values()) {
    arr.sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  }
  return porPadre;
}

/** Filas a mostrar: recorre el árbol y solo baja por los nodos expandidos. */
function filasVisibles(
  centros: CentroCostoLite[],
  porPadre: Map<string | null, CentroCostoLite[]>,
  expandidos: Set<string>,
): FilaArbol[] {
  const ids = new Set(centros.map((c) => c.id));
  const salida: FilaArbol[] = [];
  const emitir = (centro: CentroCostoLite, nivel: number) => {
    const hijos = porPadre.get(centro.id) ?? [];
    salida.push({ centro, nivel, tieneHijos: hijos.length > 0 });
    if (hijos.length > 0 && expandidos.has(centro.id)) {
      for (const h of hijos) emitir(h, nivel + 1);
    }
  };
  const raices = centros
    .filter((c) => c.centroPadreId === null || !ids.has(c.centroPadreId))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  for (const r of raices) emitir(r, 0);
  return salida;
}

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

  const porPadre = useMemo(() => indexarHijos(centros), [centros]);
  // Todo colapsado por defecto — se expande centro por centro al hacer clic.
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const filas = useMemo(() => filasVisibles(centros, porPadre, expandidos), [centros, porPadre, expandidos]);
  function alternar(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
                <TableHead className="w-64">Código / Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(({ centro, nivel, tieneHijos }) => {
                const abierto = expandidos.has(centro.id);
                return (
                  <TableRow key={centro.id}>
                    <TableCell>
                      <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${nivel * 1.25}rem` }}
                      >
                        {tieneHijos ? (
                          <button
                            type="button"
                            onClick={() => alternar(centro.id)}
                            aria-label={abierto ? "Colapsar" : "Expandir"}
                            aria-expanded={abierto}
                            className="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {abierto ? (
                              <ChevronDownIcon className="size-3.5" />
                            ) : (
                              <ChevronRightIcon className="size-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="inline-block size-4 shrink-0" />
                        )}
                        <span className="font-mono text-muted-foreground">{centro.codigo}</span>
                        <span className={nivel === 0 ? "font-semibold" : undefined}>
                          {centro.nombre}
                        </span>
                      </div>
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
                );
              })}
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
