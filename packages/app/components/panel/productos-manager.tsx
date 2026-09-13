"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { METODO_VALORACION, PRODUCTO_TIPO, crearProductoSchema } from "@erp/shared";
import { crearProductoAction, editarProductoAction } from "@/lib/actions/productos";
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

export type Opcion = { id: string; label: string };
export type ProductoLite = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  grupoId: string;
  grupoNombre: string;
  precioUnitario: number;
  unidadMedida: string | null;
  codigoBarras: string | null;
  glosaSugerida: string | null;
  esVenta: boolean;
  esCompra: boolean;
  esInventario: boolean;
  metodoValoracion: string;
  costoEstandar: number;
};

type FormValues = z.input<typeof crearProductoSchema>;

export function ProductosManager({
  empresaId,
  productos,
  grupos,
}: {
  empresaId: string;
  productos: ProductoLite[];
  grupos: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<ProductoLite | null>(null);
  const sinGrupos = grupos.length === 0;

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearProductoSchema),
    defaultValues: valoresDe(null, grupos),
  });

  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion, grupos));
  }, [abierto, enEdicion, grupos, reset]);

  const clp = useMemo(() => new Intl.NumberFormat("es-CL"), []);
  const porGrupo = useAgrupado(productos, (p) => p.grupoId);
  const { expandidos: gruposAbiertos, alternar: alternarGrupo } = useExpandidos();

  const esServicio = watch("tipo") === "Servicio";
  const esInventario = !esServicio && !!watch("esInventario");

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = enEdicion
        ? await editarProductoAction(empresaId, enEdicion.id, data)
        : await crearProductoAction(empresaId, data);
      if (r.ok) {
        toast.success(enEdicion ? "Producto actualizado" : "Producto creado");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {sinGrupos ? (
          <p className="text-sm text-destructive">
            Crea primero un grupo de productos (Inventario → Grupos de artículos).
          </p>
        ) : (
          <span />
        )}
        <Button
          disabled={sinGrupos}
          onClick={() => {
            setEnEdicion(null);
            setAbierto(true);
          }}
        >
          Nuevo producto
        </Button>
      </div>

      {productos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta empresa no tiene productos.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...porGrupo.entries()].map(([grupoId, items]) => {
                const abierto = gruposAbiertos.has(grupoId);
                return (
                  <Fragment key={grupoId}>
                    <FilaGrupo
                      abierto={abierto}
                      onToggle={() => alternarGrupo(grupoId)}
                      colSpan={6}
                    >
                      {items[0]?.grupoNombre} ({items.length})
                    </FilaGrupo>
                    {abierto &&
                      items.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono">{p.codigo}</TableCell>
                          <TableCell className="font-medium">{p.nombre}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.tipo}
                            <span className="ml-2 inline-flex gap-1 align-middle">
                              {p.esInventario && <Badge variant="ghost">Inventario</Badge>}
                              {p.esCompra && <Badge variant="ghost">Compra</Badge>}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {clp.format(p.precioUnitario)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.estado === "Activo" ? "secondary" : "destructive"}>
                              {p.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEnEdicion(p);
                                setAbierto(true);
                              }}
                            >
                              Editar
                            </Button>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{enEdicion ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={enEdicion ? enEdicion.codigo : ""}
                  placeholder={enEdicion ? undefined : "Se asigna automáticamente"}
                  disabled
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" {...register("nombre")} />
                {errors.nombre && (
                  <p className="text-sm text-destructive">{errors.nombre.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Grupo (define la imputación contable)</Label>
                <Select value={watch("grupoId")} onValueChange={(v) => setValue("grupoId", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige un grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {grupos.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={watch("tipo")}
                  onValueChange={(v) => setValue("tipo", v as FormValues["tipo"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTO_TIPO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="precioUnitario">Precio unitario de referencia</Label>
                <Input
                  id="precioUnitario"
                  type="number"
                  step="0.01"
                  {...register("precioUnitario", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidadMedida">Unidad de medida</Label>
                <Input id="unidadMedida" placeholder="UN, KG, HH…" {...register("unidadMedida")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codigoBarras">Código de barras</Label>
                <Input id="codigoBarras" {...register("codigoBarras")} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={watch("estado")}
                  onValueChange={(v) => setValue("estado", v as FormValues["estado"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Activo">Activo</SelectItem>
                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="glosaSugerida">Glosa sugerida</Label>
              <Input id="glosaSugerida" {...register("glosaSugerida")} />
            </div>

            <p className="text-xs text-muted-foreground">
              La cuenta de ingreso, impuesto, centro de costo, categoría, existencias, costo de
              venta y gasto de compra las define el grupo — no se pueden fijar por producto (así
              se administran en un solo lugar). Ajusta el grupo en Inventario → Grupos de artículos.
            </p>

            <div className="flex flex-wrap gap-6 border-t pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" {...register("esVenta")} />
                Se vende
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" {...register("esCompra")} />
                Se compra
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  disabled={esServicio}
                  {...register("esInventario")}
                />
                Es de inventario {esServicio && "(no aplica a servicios)"}
              </label>
            </div>

            {esInventario && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Método de valoración</Label>
                  <Select
                    value={watch("metodoValoracion")}
                    onValueChange={(v) =>
                      setValue("metodoValoracion", v as FormValues["metodoValoracion"])
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METODO_VALORACION.filter((m) => m === "Promedio").map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costoEstandar">Costo inicial / de referencia</Label>
                  <Input
                    id="costoEstandar"
                    type="number"
                    step="0.01"
                    {...register("costoEstandar", { valueAsNumber: true })}
                  />
                </div>
              </div>
            )}

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

function valoresDe(p: ProductoLite | null, grupos: Opcion[]): FormValues {
  return {
    codigo: p?.codigo ?? undefined,
    nombre: p?.nombre ?? "",
    tipo: (p?.tipo as FormValues["tipo"]) ?? "Producto",
    estado: (p?.estado as FormValues["estado"]) ?? "Activo",
    grupoId: p?.grupoId ?? grupos[0]?.id ?? "",
    precioUnitario: p?.precioUnitario ?? 0,
    unidadMedida: p?.unidadMedida ?? "",
    codigoBarras: p?.codigoBarras ?? "",
    glosaSugerida: p?.glosaSugerida ?? "",
    esVenta: p?.esVenta ?? true,
    esCompra: p?.esCompra ?? false,
    esInventario: p?.esInventario ?? false,
    metodoValoracion: (p?.metodoValoracion as FormValues["metodoValoracion"]) ?? "Promedio",
    costoEstandar: p?.costoEstandar ?? 0,
  };
}
