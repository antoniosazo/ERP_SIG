"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { TIPO_TERCERO, editarTerceroSchema } from "@erp/shared";
import { editarTerceroAction } from "@/lib/actions/terceros";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Opcion = { id: string; label: string };
type FormValues = z.input<typeof editarTerceroSchema>;
const NINGUNA = "__none__";

export function TerceroGeneralForm({
  empresaId,
  terceroId,
  codigo,
  valoresIniciales,
  cuentas,
  categorias,
  monedas,
  impuestos,
  grupos,
}: {
  empresaId: string;
  terceroId: string;
  codigo: string | null;
  valoresIniciales: FormValues;
  cuentas: Opcion[];
  categorias: Opcion[];
  monedas: Opcion[];
  impuestos: Opcion[];
  grupos: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(editarTerceroSchema),
    defaultValues: valoresIniciales,
  });

  const bloqueado = watch("bloqueado");

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = await editarTerceroAction(empresaId, terceroId, data);
      if (r.ok) {
        toast.success("Datos del socio actualizados");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  });

  const opt = (name: keyof FormValues, opciones: Opcion[], placeholder: string) => (
    <Select
      value={(watch(name) as string | undefined) ?? NINGUNA}
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
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 @xl:grid-cols-2">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={codigo ?? "—"} readOnly className="bg-muted/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rut">RUT</Label>
              <Input id="rut" {...register("rut")} />
              {errors.rut && <p className="text-sm text-destructive">{errors.rut.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="razonSocial">Razón social</Label>
              <Input id="razonSocial" {...register("razonSocial")} />
              {errors.razonSocial && (
                <p className="text-sm text-destructive">{errors.razonSocial.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombreFantasia">Nombre de fantasía</Label>
              <Input id="nombreFantasia" {...register("nombreFantasia")} />
            </div>
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="giro">Giro</Label>
              <Input id="giro" {...register("giro")} />
            </div>
            <div className="space-y-2">
              <Label>Grupo de socios</Label>
              {opt("grupoId", grupos, "Sin grupo")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" {...register("telefono")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sitioWeb">Sitio web</Label>
              <Input id="sitioWeb" {...register("sitioWeb")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" {...register("direccion")} />
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("activo")} /> Activo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("bloqueado")} /> Bloqueado
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("pendienteCompletar")} /> Ficha
              pendiente
            </label>
          </div>
          {bloqueado && (
            <div className="space-y-2">
              <Label htmlFor="motivoBloqueo">Motivo del bloqueo</Label>
              <Input id="motivoBloqueo" {...register("motivoBloqueo")} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notas">Comentarios</Label>
            <textarea
              id="notas"
              rows={3}
              {...register("notas")}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos contables y comerciales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 @xl:grid-cols-2">
            <div className="space-y-2">
              <Label>Cuenta contable asociada</Label>
              {opt("cuentaContableAsociadaId", cuentas, "Sin cuenta")}
            </div>
            <div className="space-y-2">
              <Label>Categoría contable por defecto</Label>
              {opt("categoriaContableDefaultId", categorias, "Sin categoría")}
            </div>
            <div className="space-y-2">
              <Label>Moneda por defecto</Label>
              {opt("monedaId", monedas, "Moneda de la empresa")}
            </div>
            <div className="space-y-2">
              <Label>Impuesto por defecto</Label>
              {opt("impuestoDefaultId", impuestos, "Sin impuesto")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="condicionPagoDias">Condición de pago (días)</Label>
              <Input
                id="condicionPagoDias"
                type="number"
                min={0}
                max={365}
                {...register("condicionPagoDias", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limiteCredito">Límite de crédito</Label>
              <Input
                id="limiteCredito"
                type="number"
                min={0}
                step="0.01"
                {...register("limiteCredito", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retencionHonorariosPct">Retención honorarios (%)</Label>
              <Input
                id="retencionHonorariosPct"
                type="number"
                min={0}
                max={100}
                step="0.01"
                {...register("retencionHonorariosPct", {
                  setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("esEmisorBoletaHonorarios")} />
              Emite boletas de honorarios
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("esReceptorBoletaHonorarios")} />
              Recibe boletas de honorarios
            </label>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
