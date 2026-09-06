"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { CATEGORIA_APLICA_A, IVA_RECUPERABLE, crearCategoriaSchema } from "@erp/shared";
import { crearCategoriaAction, editarCategoriaAction } from "@/lib/actions/categorias";
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

export type CategoriaLite = {
  id: string;
  nombre: string;
  aplicaA: string;
  cuentaGastoId: string | null;
  cuentaIngresoId: string | null;
  cuentaCostoId: string | null;
  cuentaActivoId: string | null;
  centroCostoDefaultId: string | null;
  ivaRecuperableDefault: string | null;
};
export type Opcion = { id: string; label: string };

type FormValues = z.input<typeof crearCategoriaSchema>;
const NINGUNA = "__none__";

type CampoCuenta =
  | "cuentaGastoId"
  | "cuentaIngresoId"
  | "cuentaCostoId"
  | "cuentaActivoId";

const CUENTAS: Array<[CampoCuenta, string]> = [
  ["cuentaGastoId", "Cuenta de gasto"],
  ["cuentaIngresoId", "Cuenta de ingreso"],
  ["cuentaCostoId", "Cuenta de costo"],
  ["cuentaActivoId", "Cuenta de activo"],
];

export function CategoriasManager({
  empresaId,
  categorias,
  cuentas,
  centrosCosto,
}: {
  empresaId: string;
  categorias: CategoriaLite[];
  cuentas: Opcion[];
  centrosCosto: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<CategoriaLite | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearCategoriaSchema),
    defaultValues: valoresDe(null),
  });

  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion));
  }, [abierto, enEdicion, reset]);

  const etiquetaCuenta = useMemo(() => new Map(cuentas.map((c) => [c.id, c.label])), [cuentas]);

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = enEdicion
        ? await editarCategoriaAction(empresaId, enEdicion.id, data)
        : await crearCategoriaAction(empresaId, data);
      if (result.ok) {
        toast.success(enEdicion ? "Categoría actualizada" : "Categoría creada");
        setAbierto(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  });

  function selectCuenta(name: CampoCuenta, label: string) {
    const value = watch(name) ?? NINGUNA;
    return (
      <div className="space-y-2" key={name}>
        <Label>{label}</Label>
        <Select
          value={value}
          onValueChange={(v) => setValue(name, v === NINGUNA ? undefined : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sin cuenta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NINGUNA}>Sin cuenta</SelectItem>
            {cuentas.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEnEdicion(null);
            setAbierto(true);
          }}
        >
          Nueva categoría
        </Button>
      </div>

      {categorias.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta empresa no tiene categorías contables.
        </p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Aplica a</TableHead>
                <TableHead>Gasto</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{cat.aplicaA}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {cat.cuentaGastoId ? etiquetaCuenta.get(cat.cuentaGastoId) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {cat.cuentaIngresoId ? etiquetaCuenta.get(cat.cuentaIngresoId) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEnEdicion(cat);
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{enEdicion ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" {...register("nombre")} />
                {errors.nombre && (
                  <p className="text-sm text-destructive">{errors.nombre.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="aplicaA">Aplica a</Label>
                <Select
                  value={watch("aplicaA")}
                  onValueChange={(v) => setValue("aplicaA", v as FormValues["aplicaA"])}
                >
                  <SelectTrigger id="aplicaA" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIA_APLICA_A.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {CUENTAS.map(([name, label]) => selectCuenta(name, label))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Centro de costo por defecto</Label>
                <Select
                  value={watch("centroCostoDefaultId") ?? NINGUNA}
                  onValueChange={(v) =>
                    setValue("centroCostoDefaultId", v === NINGUNA ? undefined : v)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin centro de costo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNA}>Sin centro de costo</SelectItem>
                    {centrosCosto.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>IVA recuperable por defecto</Label>
                <Select
                  value={watch("ivaRecuperableDefault") ?? NINGUNA}
                  onValueChange={(v) =>
                    setValue(
                      "ivaRecuperableDefault",
                      (v === NINGUNA ? undefined : v) as FormValues["ivaRecuperableDefault"],
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin definir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NINGUNA}>Sin definir</SelectItem>
                    {IVA_RECUPERABLE.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

function valoresDe(cat: CategoriaLite | null): FormValues {
  return {
    nombre: cat?.nombre ?? "",
    aplicaA: (cat?.aplicaA as FormValues["aplicaA"]) ?? CATEGORIA_APLICA_A[0],
    cuentaGastoId: cat?.cuentaGastoId ?? undefined,
    cuentaIngresoId: cat?.cuentaIngresoId ?? undefined,
    cuentaCostoId: cat?.cuentaCostoId ?? undefined,
    cuentaActivoId: cat?.cuentaActivoId ?? undefined,
    centroCostoDefaultId: cat?.centroCostoDefaultId ?? undefined,
    ivaRecuperableDefault:
      (cat?.ivaRecuperableDefault as FormValues["ivaRecuperableDefault"]) ?? undefined,
  };
}
