"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { editarVisualizacionSchema, formatearNumero } from "@erp/shared";
import { editarVisualizacionAction } from "@/lib/actions/empresas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormValues = z.input<typeof editarVisualizacionSchema>;

// radix Select no admite value="" — se mapea a un centinela.
const MILES = [
  { real: ".", token: ".", label: "Punto ( . )" },
  { real: ",", token: ",", label: "Coma ( , )" },
  { real: " ", token: "__space__", label: "Espacio" },
  { real: "", token: "__none__", label: "Ninguno" },
] as const;
const tokenDe = (real: string) => MILES.find((m) => m.real === real)?.token ?? "__none__";
const realDe = (token: string) => MILES.find((m) => m.token === token)?.real ?? "";

export function VisualizacionForm({
  empresaId,
  valoresIniciales,
  decimalesBloqueados = false,
}: {
  empresaId: string;
  valoresIniciales: FormValues;
  /** La empresa ya tiene transacciones: los decimales del tipo de cambio no se cambian. */
  decimalesBloqueados?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(editarVisualizacionSchema),
    defaultValues: valoresIniciales,
  });

  const separadorDecimal = watch("separadorDecimal") || ",";
  const separadorMiles = watch("separadorMiles") ?? ".";
  const decimalesTipoCambio = Number(watch("decimalesTipoCambio")) || 0;
  const fmt = { separadorDecimal, separadorMiles };

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await editarVisualizacionAction(empresaId, data);
      if (result.ok) {
        toast.success("Formato de números actualizado");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 @xl:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="separadorDecimal">Separador decimal</Label>
          <Select
            value={separadorDecimal}
            onValueChange={(v) => setValue("separadorDecimal", v as FormValues["separadorDecimal"])}
          >
            <SelectTrigger id="separadorDecimal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=",">Coma ( , )</SelectItem>
              <SelectItem value=".">Punto ( . )</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="separadorMiles">Separador de miles</Label>
          <Select
            value={tokenDe(separadorMiles)}
            onValueChange={(v) =>
              setValue("separadorMiles", realDe(v) as FormValues["separadorMiles"])
            }
          >
            <SelectTrigger id="separadorMiles" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MILES.map((m) => (
                <SelectItem key={m.token} value={m.token}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.separadorMiles && (
            <p className="text-sm text-destructive">{errors.separadorMiles.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="decimalesTipoCambio">Decimales de tipo de cambio</Label>
          <Input
            id="decimalesTipoCambio"
            type="number"
            min={0}
            max={6}
            disabled={decimalesBloqueados}
            {...register("decimalesTipoCambio", { valueAsNumber: true })}
          />
          {decimalesBloqueados ? (
            <p className="text-xs text-muted-foreground">
              Bloqueado: la empresa ya tiene transacciones contables.
            </p>
          ) : (
            errors.decimalesTipoCambio && (
              <p className="text-sm text-destructive">{errors.decimalesTipoCambio.message}</p>
            )
          )}
        </div>
      </div>

      <div className="rounded-xl bg-muted/40 p-4 text-sm">
        <p className="mb-2 font-medium text-muted-foreground">Vista previa</p>
        <dl className="grid gap-1 @sm:grid-cols-2">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Monto (ej. 2 decimales)</dt>
            <dd className="font-mono tabular-nums">
              {formatearNumero(1234567.891, 2, fmt)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Tipo de cambio</dt>
            <dd className="font-mono tabular-nums">
              {formatearNumero(953.4567, decimalesTipoCambio, fmt)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Los decimales de cada moneda se definen en <span className="font-medium">Monedas</span>.
        </p>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
