"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  CARTOLA_CAMPO_DESTINO,
  CARTOLA_CODIFICACION,
  CARTOLA_FORMATO_FECHA,
  CARTOLA_FORMATO_NUMERO,
  CARTOLA_REGLA_SIGNO,
  CARTOLA_TIPO_ARCHIVO,
  guardarFormatoCartolaSchema,
} from "@erp/shared";
import { guardarFormatoCartolaAction } from "@/lib/actions/cartolas-formatos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusIcon, TrashIcon } from "lucide-react";

export type FormatoCartolaFila = {
  id: string;
  bancoId: string;
  empresaId: string | null;
  nombre: string;
  tipoArchivo: string;
  codificacion: string;
  separador: string | null;
  filasOmitirInicio: number;
  filasOmitirFin: number;
  formatoFecha: string;
  formatoNumero: string;
  reglaSigno: string;
  activo: boolean;
  campos: { campoDestino: string; columnaIndice: number | null; posicionInicio: number | null; posicionLargo: number | null }[];
};
type Opcion = { id: string; label: string };
type FormValues = z.input<typeof guardarFormatoCartolaSchema>;

function valoresDe(f: FormatoCartolaFila | null): FormValues {
  return {
    id: f?.id,
    bancoId: f?.bancoId ?? "",
    nombre: f?.nombre ?? "",
    tipoArchivo: (f?.tipoArchivo as FormValues["tipoArchivo"]) ?? "Excel",
    codificacion: (f?.codificacion as FormValues["codificacion"]) ?? "UTF-8",
    separador: f?.separador ?? ";",
    filasOmitirInicio: f?.filasOmitirInicio ?? 0,
    filasOmitirFin: f?.filasOmitirFin ?? 0,
    formatoFecha: (f?.formatoFecha as FormValues["formatoFecha"]) ?? "dd/mm/aaaa",
    formatoNumero: (f?.formatoNumero as FormValues["formatoNumero"]) ?? "MilesPuntoDecimalComa",
    reglaSigno: (f?.reglaSigno as FormValues["reglaSigno"]) ?? "ColumnasSeparadas",
    activo: f?.activo ?? true,
    campos: f?.campos.map((c) => ({
      campoDestino: c.campoDestino as FormValues["campos"][number]["campoDestino"],
      columnaIndice: c.columnaIndice,
      posicionInicio: c.posicionInicio,
      posicionLargo: c.posicionLargo,
    })) ?? [{ campoDestino: "Fecha", columnaIndice: 0, posicionInicio: null, posicionLargo: null }],
  };
}

const CAMPO_LABEL: Record<string, string> = {
  Fecha: "Fecha",
  Descripcion: "Descripción",
  NroDocumento: "N° de documento",
  Cargo: "Cargo",
  Abono: "Abono",
  MontoConSigno: "Monto con signo",
  Saldo: "Saldo",
  Sucursal: "Sucursal",
  RutContraparte: "RUT contraparte",
};

export function CartolasFormatosManager({
  empresaId,
  formatos,
  bancos,
}: {
  empresaId: string;
  formatos: FormatoCartolaFila[];
  bancos: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<FormatoCartolaFila | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(guardarFormatoCartolaSchema),
    defaultValues: valoresDe(null),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "campos" });
  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion));
  }, [abierto, enEdicion, reset]);

  const tipoArchivo = watch("tipoArchivo");
  const reglaSigno = watch("reglaSigno");
  const esAnchoFijo = tipoArchivo === "TxtAnchoFijo";

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = await guardarFormatoCartolaAction(empresaId, data);
      if (r.ok) {
        toast.success(enEdicion ? "Plantilla actualizada" : "Plantilla creada");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  });

  const bancoNombre = (id: string) => bancos.find((b) => b.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEnEdicion(null);
            setAbierto(true);
          }}
        >
          Nueva plantilla
        </Button>
      </div>

      {formatos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay plantillas de cartola. Crea una por banco para poder importar sus cartolas.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo de archivo</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formatos.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{bancoNombre(f.bancoId)}</TableCell>
                  <TableCell>{f.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{f.tipoArchivo}</TableCell>
                  <TableCell>
                    <Badge variant={f.empresaId ? "outline" : "secondary"}>{f.empresaId ? "Propia" : "Plantilla"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={f.activo ? "default" : "secondary"}>{f.activo ? "Activa" : "Inactiva"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {f.empresaId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEnEdicion(f);
                          setAbierto(true);
                        }}
                      >
                        Editar
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Solo lectura</span>
                    )}
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
            <DialogTitle>{enEdicion ? "Editar plantilla de cartola" : "Nueva plantilla de cartola"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bancoId">Banco</Label>
                <Select value={watch("bancoId") || undefined} onValueChange={(v) => setValue("bancoId", v)}>
                  <SelectTrigger id="bancoId" className="w-full">
                    <SelectValue placeholder="Selecciona un banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {bancos.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.bancoId && <p className="text-sm text-destructive">{errors.bancoId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" placeholder="Ej. Cartola Excel cuenta corriente" {...register("nombre")} />
                {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tipoArchivo">Tipo de archivo</Label>
                <Select value={watch("tipoArchivo")} onValueChange={(v) => setValue("tipoArchivo", v as FormValues["tipoArchivo"])}>
                  <SelectTrigger id="tipoArchivo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARTOLA_TIPO_ARCHIVO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "Excel" ? "Excel" : t === "CsvTxtDelimitado" ? "CSV / TXT delimitado" : "TXT ancho fijo"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="codificacion">Codificación</Label>
                <Select value={watch("codificacion")} onValueChange={(v) => setValue("codificacion", v as FormValues["codificacion"])}>
                  <SelectTrigger id="codificacion" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARTOLA_CODIFICACION.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {tipoArchivo === "CsvTxtDelimitado" && (
                <div className="space-y-2">
                  <Label htmlFor="separador">Separador</Label>
                  <Input id="separador" placeholder=";" {...register("separador")} />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="filasOmitirInicio">Filas a omitir al inicio</Label>
                <Input id="filasOmitirInicio" type="number" min={0} {...register("filasOmitirInicio", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filasOmitirFin">Filas a omitir al final</Label>
                <Input id="filasOmitirFin" type="number" min={0} {...register("filasOmitirFin", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="formatoFecha">Formato de fecha</Label>
                <Select value={watch("formatoFecha")} onValueChange={(v) => setValue("formatoFecha", v as FormValues["formatoFecha"])}>
                  <SelectTrigger id="formatoFecha" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARTOLA_FORMATO_FECHA.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="formatoNumero">Formato de número</Label>
                <Select value={watch("formatoNumero")} onValueChange={(v) => setValue("formatoNumero", v as FormValues["formatoNumero"])}>
                  <SelectTrigger id="formatoNumero" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARTOLA_FORMATO_NUMERO.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f === "MilesPuntoDecimalComa" ? "1.234,56" : f === "MilesComaDecimalPunto" ? "1,234.56" : "1234.56"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reglaSigno">Regla de signo</Label>
                <Select value={watch("reglaSigno")} onValueChange={(v) => setValue("reglaSigno", v as FormValues["reglaSigno"])}>
                  <SelectTrigger id="reglaSigno" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARTOLA_REGLA_SIGNO.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r === "ColumnasSeparadas" ? "Columnas cargo/abono" : "Una columna con signo"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="activo">Estado</Label>
              <Select value={watch("activo") ? "1" : "0"} onValueChange={(v) => setValue("activo", v === "1")}>
                <SelectTrigger id="activo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Activa</SelectItem>
                  <SelectItem value="0">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label>Campos mapeados</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ campoDestino: "Descripcion", columnaIndice: 0, posicionInicio: null, posicionLargo: null })}
                >
                  <PlusIcon className="size-3.5" /> Agregar campo
                </Button>
              </div>
              {reglaSigno === "ColumnasSeparadas" ? (
                <p className="text-xs text-muted-foreground">Mapea Cargo y Abono por separado.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Mapea Monto con signo (positivo abono, negativo cargo).</p>
              )}
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div key={field.id} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Campo</Label>
                      <Select
                        value={watch(`campos.${i}.campoDestino`)}
                        onValueChange={(v) => setValue(`campos.${i}.campoDestino`, v as FormValues["campos"][number]["campoDestino"])}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CARTOLA_CAMPO_DESTINO.map((c) => (
                            <SelectItem key={c} value={c}>
                              {CAMPO_LABEL[c]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {esAnchoFijo ? (
                      <>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Posición</Label>
                          <Input type="number" min={0} {...register(`campos.${i}.posicionInicio`, { valueAsNumber: true })} />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Largo</Label>
                          <Input type="number" min={1} {...register(`campos.${i}.posicionLargo`, { valueAsNumber: true })} />
                        </div>
                      </>
                    ) : (
                      <div className="w-24 space-y-1">
                        <Label className="text-xs">Columna</Label>
                        <Input type="number" min={0} {...register(`campos.${i}.columnaIndice`, { valueAsNumber: true })} />
                      </div>
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={fields.length <= 1}>
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {errors.campos && <p className="text-sm text-destructive">{errors.campos.message as string}</p>}
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
