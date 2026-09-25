"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { ACTIVO_FIJO_TIPO, LIBRO_CONTABLE, crearClaseActivoFijoSchema, type LibroContable } from "@erp/shared";
import {
  crearClaseActivoFijoAction,
  editarClaseActivoFijoAction,
  guardarCuentasClaseAction,
} from "@/lib/actions/activos-fijos-config";
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

export type ClaseActivoFijoLite = {
  id: string;
  codigo: string;
  nombre: string;
  tipoActivo: string;
  activa: boolean;
};

export type CuentaClaseLite = {
  claseId: string;
  libro: string;
  ctaActivo: string | null;
  ctaDepAcumulada: string | null;
  ctaGastoDep: string | null;
  ctaCompensacionCapitalizacion: string | null;
  ctaUtilidadBaja: string | null;
  ctaPerdidaBaja: string | null;
  ctaValorLibroBaja: string | null;
  ctaCorreccionMonetaria: string | null;
};

type Opcion = { id: string; label: string };
type FormValues = z.input<typeof crearClaseActivoFijoSchema>;
const SIN_CUENTA = "__none__";

export function ActivosFijosClasesManager({
  empresaId,
  clases,
  cuentasClase,
  cuentas,
}: {
  empresaId: string;
  clases: ClaseActivoFijoLite[];
  cuentasClase: CuentaClaseLite[];
  cuentas: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<ClaseActivoFijoLite | null>(null);
  const [claseCuentas, setClaseCuentas] = useState<ClaseActivoFijoLite | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(crearClaseActivoFijoSchema),
    defaultValues: valoresDe(null),
  });

  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion));
  }, [abierto, enEdicion, reset]);

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = enEdicion
        ? await editarClaseActivoFijoAction(empresaId, enEdicion.id, data)
        : await crearClaseActivoFijoAction(empresaId, data);
      if (result.ok) {
        toast.success(enEdicion ? "Clase actualizada" : "Clase creada");
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
          Nueva clase de activo
        </Button>
      </div>

      {clases.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta empresa no tiene clases de activo.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Código / Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-mono text-muted-foreground">{c.codigo}</span>{" "}
                    <span className="font-medium">{c.nombre}</span>
                  </TableCell>
                  <TableCell>{c.tipoActivo}</TableCell>
                  <TableCell>
                    <Badge variant={c.activa ? "default" : "secondary"}>{c.activa ? "Activa" : "Inactiva"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setClaseCuentas(c)}>
                      Cuentas
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEnEdicion(c);
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
            <DialogTitle>{enEdicion ? "Editar clase de activo" : "Nueva clase de activo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" {...register("codigo")} />
                {errors.codigo && <p className="text-sm text-destructive">{errors.codigo.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" {...register("nombre")} />
                {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
              </div>
            </div>

            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="tipoActivo">Tipo de activo</Label>
              <Select
                value={watch("tipoActivo")}
                onValueChange={(value) => setValue("tipoActivo", value as FormValues["tipoActivo"])}
              >
                <SelectTrigger id="tipoActivo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVO_FIJO_TIPO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="activa">Estado</Label>
              <Select
                value={watch("activa") ? "true" : "false"}
                onValueChange={(value) => setValue("activa", value === "true")}
              >
                <SelectTrigger id="activa" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Activa</SelectItem>
                  <SelectItem value="false">Inactiva</SelectItem>
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

      {claseCuentas && (
        <CuentasClaseDialog
          empresaId={empresaId}
          clase={claseCuentas}
          cuentasExistentes={cuentasClase.filter((c) => c.claseId === claseCuentas.id)}
          cuentas={cuentas}
          onClose={() => setClaseCuentas(null)}
        />
      )}
    </div>
  );
}

function valoresDe(clase: ClaseActivoFijoLite | null): FormValues {
  return {
    codigo: clase?.codigo ?? "",
    nombre: clase?.nombre ?? "",
    tipoActivo: (clase?.tipoActivo as FormValues["tipoActivo"]) ?? "Tangible",
    activa: clase?.activa ?? true,
  };
}

function CuentasClaseDialog({
  empresaId,
  clase,
  cuentasExistentes,
  cuentas,
  onClose,
}: {
  empresaId: string;
  clase: ClaseActivoFijoLite;
  cuentasExistentes: CuentaClaseLite[];
  cuentas: Opcion[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [libro, setLibro] = useState<LibroContable>("Ambos");
  const actual = cuentasExistentes.find((c) => c.libro === libro) ?? null;
  const [ctaActivo, setCtaActivo] = useState(actual?.ctaActivo ?? SIN_CUENTA);
  const [ctaDepAcumulada, setCtaDepAcumulada] = useState(actual?.ctaDepAcumulada ?? SIN_CUENTA);
  const [ctaGastoDep, setCtaGastoDep] = useState(actual?.ctaGastoDep ?? SIN_CUENTA);
  const [ctaCompensacion, setCtaCompensacion] = useState(actual?.ctaCompensacionCapitalizacion ?? SIN_CUENTA);
  const [ctaUtilidadBaja, setCtaUtilidadBaja] = useState(actual?.ctaUtilidadBaja ?? SIN_CUENTA);
  const [ctaPerdidaBaja, setCtaPerdidaBaja] = useState(actual?.ctaPerdidaBaja ?? SIN_CUENTA);
  const [ctaValorLibroBaja, setCtaValorLibroBaja] = useState(actual?.ctaValorLibroBaja ?? SIN_CUENTA);
  const [ctaCorreccionMonetaria, setCtaCorreccionMonetaria] = useState(actual?.ctaCorreccionMonetaria ?? SIN_CUENTA);

  function cambiarLibro(nuevo: LibroContable) {
    setLibro(nuevo);
    const fila = cuentasExistentes.find((c) => c.libro === nuevo) ?? null;
    setCtaActivo(fila?.ctaActivo ?? SIN_CUENTA);
    setCtaDepAcumulada(fila?.ctaDepAcumulada ?? SIN_CUENTA);
    setCtaGastoDep(fila?.ctaGastoDep ?? SIN_CUENTA);
    setCtaCompensacion(fila?.ctaCompensacionCapitalizacion ?? SIN_CUENTA);
    setCtaUtilidadBaja(fila?.ctaUtilidadBaja ?? SIN_CUENTA);
    setCtaPerdidaBaja(fila?.ctaPerdidaBaja ?? SIN_CUENTA);
    setCtaValorLibroBaja(fila?.ctaValorLibroBaja ?? SIN_CUENTA);
    setCtaCorreccionMonetaria(fila?.ctaCorreccionMonetaria ?? SIN_CUENTA);
  }

  function guardar() {
    startTransition(async () => {
      const result = await guardarCuentasClaseAction(empresaId, clase.id, {
        libro,
        ctaActivo: ctaActivo === SIN_CUENTA ? null : ctaActivo,
        ctaDepAcumulada: ctaDepAcumulada === SIN_CUENTA ? null : ctaDepAcumulada,
        ctaGastoDep: ctaGastoDep === SIN_CUENTA ? null : ctaGastoDep,
        ctaCompensacionCapitalizacion: ctaCompensacion === SIN_CUENTA ? null : ctaCompensacion,
        ctaUtilidadBaja: ctaUtilidadBaja === SIN_CUENTA ? null : ctaUtilidadBaja,
        ctaPerdidaBaja: ctaPerdidaBaja === SIN_CUENTA ? null : ctaPerdidaBaja,
        ctaValorLibroBaja: ctaValorLibroBaja === SIN_CUENTA ? null : ctaValorLibroBaja,
        ctaCorreccionMonetaria: ctaCorreccionMonetaria === SIN_CUENTA ? null : ctaCorreccionMonetaria,
      });
      if (result.ok) {
        toast.success("Cuentas guardadas");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const campos: { label: string; value: string; setValue: (v: string) => void }[] = [
    { label: "Activo fijo", value: ctaActivo, setValue: setCtaActivo },
    { label: "Depreciación acumulada", value: ctaDepAcumulada, setValue: setCtaDepAcumulada },
    { label: "Gasto por depreciación", value: ctaGastoDep, setValue: setCtaGastoDep },
    { label: "Compensación de capitalización", value: ctaCompensacion, setValue: setCtaCompensacion },
    { label: "Valor libro en baja (puente)", value: ctaValorLibroBaja, setValue: setCtaValorLibroBaja },
    { label: "Utilidad en baja", value: ctaUtilidadBaja, setValue: setCtaUtilidadBaja },
    { label: "Pérdida en baja", value: ctaPerdidaBaja, setValue: setCtaPerdidaBaja },
    { label: "Corrección monetaria (Tributario)", value: ctaCorreccionMonetaria, setValue: setCtaCorreccionMonetaria },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Cuentas de {clase.codigo} — {clase.nombre}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Si dejas una cuenta sin configurar, se usa el fallback GENERAL de Determinación de cuentas.
          </p>
          <div className="space-y-2 sm:max-w-xs">
            <Label>Libro</Label>
            <Select value={libro} onValueChange={(v) => cambiarLibro(v as LibroContable)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIBRO_CONTABLE.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {campos.map((campo) => (
            <div key={campo.label} className="space-y-2">
              <Label>{campo.label}</Label>
              <Select value={campo.value} onValueChange={campo.setValue}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin cuenta (usa el fallback GENERAL)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_CUENTA}>Sin cuenta (usa el fallback GENERAL)</SelectItem>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" onClick={guardar} disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
