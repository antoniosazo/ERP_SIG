"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  IMPUESTO_TIPO,
  IVA_RECUPERABLE,
  TIPO_OPERACION_DOCUMENTO,
  crearImpuestoSchema,
} from "@erp/shared";
import {
  crearImpuestoAction,
  editarImpuestoAction,
  eliminarImpuestoAction,
} from "@/lib/actions/impuestos";
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

export type ImpuestoLite = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  tasa: string;
  cuentaContableId: string | null;
  recuperableDefault: string | null;
  aplicaA: string;
  activo: boolean;
};
export type Opcion = { id: string; label: string };

type FormValues = z.input<typeof crearImpuestoSchema>;
const NINGUNA = "__none__";
const SIN_TASA = new Set(["Exento", "No Afecto"]);

export function ImpuestosManager({
  empresaId,
  impuestos,
  cuentas,
}: {
  empresaId: string;
  impuestos: ImpuestoLite[];
  cuentas: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<ImpuestoLite | null>(null);
  const [aEliminar, setAEliminar] = useState<ImpuestoLite | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearImpuestoSchema),
    defaultValues: valoresDe(null),
  });

  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion));
  }, [abierto, enEdicion, reset]);

  const tipo = watch("tipo");
  const tasaBloqueada = SIN_TASA.has(tipo);

  useEffect(() => {
    if (tasaBloqueada) setValue("tasa", 0);
  }, [tasaBloqueada, setValue]);

  const etiquetaCuenta = new Map(cuentas.map((c) => [c.id, c.label]));

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = enEdicion
        ? await editarImpuestoAction(empresaId, enEdicion.id, data)
        : await crearImpuestoAction(empresaId, data);
      if (result.ok) {
        toast.success(enEdicion ? "Impuesto actualizado" : "Impuesto creado");
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
      const result = await eliminarImpuestoAction(empresaId, aEliminar.id);
      if (result.ok) {
        toast.success(`Impuesto ${aEliminar.codigo} eliminado`);
        setAEliminar(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
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
          Nuevo impuesto
        </Button>
      </div>

      {impuestos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta empresa no tiene impuestos.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Tasa %</TableHead>
                <TableHead>Aplica a</TableHead>
                <TableHead>Cuenta contable</TableHead>
                <TableHead>Recuperabilidad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {impuestos.map((i) => (
                <TableRow key={i.id} className={i.activo ? undefined : "opacity-50"}>
                  <TableCell className="font-mono font-medium">{i.codigo}</TableCell>
                  <TableCell>
                    {i.nombre}
                    {!i.activo && (
                      <Badge variant="secondary" className="ml-2">
                        Inactivo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{i.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Number(i.tasa)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i.aplicaA}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.cuentaContableId ? etiquetaCuenta.get(i.cuentaContableId) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.recuperableDefault ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEnEdicion(i);
                        setAbierto(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setAEliminar(i)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{enEdicion ? "Editar impuesto" : "Nuevo impuesto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" {...register("codigo")} placeholder="IVA-DF" />
                {errors.codigo && (
                  <p className="text-sm text-destructive">{errors.codigo.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" {...register("nombre")} placeholder="IVA Débito Fiscal" />
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
                    {IMPUESTO_TIPO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tasa">Tasa %</Label>
                <Input
                  id="tasa"
                  type="number"
                  step="0.001"
                  min={0}
                  max={100}
                  disabled={tasaBloqueada}
                  {...register("tasa", { valueAsNumber: true })}
                />
                {errors.tasa && (
                  <p className="text-sm text-destructive">{errors.tasa.message}</p>
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
                    {TIPO_OPERACION_DOCUMENTO.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cuenta contable</Label>
                <Select
                  value={watch("cuentaContableId") ?? NINGUNA}
                  onValueChange={(v) =>
                    setValue("cuentaContableId", v === NINGUNA ? undefined : v)
                  }
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
              {tipo === "IVA Crédito" && (
                <div className="space-y-2">
                  <Label>Recuperabilidad por defecto</Label>
                  <Select
                    value={watch("recuperableDefault") ?? NINGUNA}
                    onValueChange={(v) =>
                      setValue(
                        "recuperableDefault",
                        (v === NINGUNA ? undefined : v) as FormValues["recuperableDefault"],
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sin definir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NINGUNA}>Sin definir</SelectItem>
                      {IVA_RECUPERABLE.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("activo")} />
              Activo
            </label>

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
            <DialogTitle>Eliminar impuesto</DialogTitle>
            <DialogDescription>
              ¿Eliminar {aEliminar?.codigo} — {aEliminar?.nombre}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAEliminar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={confirmarEliminar}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function valoresDe(i: ImpuestoLite | null): FormValues {
  return {
    codigo: i?.codigo ?? "",
    nombre: i?.nombre ?? "",
    tipo: (i?.tipo as FormValues["tipo"]) ?? IMPUESTO_TIPO[0],
    tasa: i ? Number(i.tasa) : 19,
    cuentaContableId: i?.cuentaContableId ?? undefined,
    recuperableDefault: (i?.recuperableDefault as FormValues["recuperableDefault"]) ?? undefined,
    aplicaA: (i?.aplicaA as FormValues["aplicaA"]) ?? "Ambos",
    activo: i?.activo ?? true,
  };
}
