"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  CLASE_CUENTA,
  CLASIFICACION_CORRIENTE,
  CUENTA_MODO_MONEDA,
  MAX_PROFUNDIDAD_CUENTA,
  NATURALEZA_CUENTA,
  TIPO_CUENTA,
  crearCuentaSchema,
  naturalezaSugerida,
} from "@erp/shared";
import type { ClaseCuenta } from "@erp/shared";
import { crearCuentaAction, editarCuentaAction } from "@/lib/actions/plan-cuentas";
import {
  profundidadDeCuenta,
  siguienteCodigoHijo,
  siguienteCodigoRaiz,
} from "@/lib/plan-cuentas-codigo";
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

export type Opcion = { id: string; label: string };
export type CuentaLite = {
  id: string;
  codigoCuenta: string;
  nombreCuenta: string;
  clase: string;
  naturaleza: string;
  tipoCuenta: string;
  clasificacionCorriente: string;
  cuentaPadreId: string | null;
  nivelImputable: boolean;
  requiereCentroCosto: boolean;
  requiereAnalisisTerceros: boolean;
  modoMoneda: string;
  monedaFijaId: string | null;
  relevanteFlujoCaja: boolean;
  esCuentaAjuste: boolean;
  activa: boolean;
  tieneMovimientos?: boolean;
};

type FormValues = z.input<typeof crearCuentaSchema>;

const SIN_PADRE = "__none__";
const SIN_MONEDA = "__none__";

const FLAGS = [
  ["nivelImputable", "Cuenta imputable (recibe movimientos)"],
  ["requiereCentroCosto", "Requiere centro de costo"],
  ["requiereAnalisisTerceros", "Cuenta de control (exige tercero en la línea)"],
  ["relevanteFlujoCaja", "Relevante para flujo de caja"],
  ["esCuentaAjuste", "Es cuenta de ajuste"],
  ["activa", "Activa"],
] as const;

export function CuentaFormDialog({
  empresaId,
  cuentas,
  cuenta,
  padreInicial = null,
  monedas,
  open,
  onOpenChange,
}: {
  empresaId: string;
  cuentas: CuentaLite[];
  cuenta: CuentaLite | null;
  padreInicial?: CuentaLite | null;
  monedas: Opcion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const esEdicion = cuenta !== null;
  const bloqueado = esEdicion && !!cuenta?.tieneMovimientos;
  // Cuenta "principal" = raíz de nivel 1: código y nombre no se pueden modificar.
  const esPrincipal = esEdicion && cuenta.cuentaPadreId === null;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(crearCuentaSchema),
    defaultValues: valoresDe(cuenta, padreInicial),
  });

  useEffect(() => {
    if (open) reset(valoresDe(cuenta, padreInicial));
  }, [open, cuenta, padreInicial, reset]);

  const cuentaPadreId = watch("cuentaPadreId");
  const tienePadre = !!cuentaPadreId;
  const modoMoneda = watch("modoMoneda");
  const codigoActual = (watch("codigoCuenta") ?? "").trim();

  const modosMoneda = CUENTA_MODO_MONEDA.filter((m) => m !== "Local" || modoMoneda === "Local");

  const padreSel = cuentaPadreId ? cuentas.find((c) => c.id === cuentaPadreId) : undefined;
  const codigoPadre = padreSel?.codigoCuenta;

  // En alta el código es automático (solo lectura): hijo de un padre → `<padre>.<n+1>`,
  // sin padre → siguiente cuenta raíz.
  const codigoAuto = esEdicion
    ? cuenta.codigoCuenta
    : padreSel
      ? siguienteCodigoHijo(padreSel, cuentas)
      : siguienteCodigoRaiz(cuentas);

  const prefijoInvalido =
    esEdicion &&
    !esPrincipal &&
    !!codigoPadre &&
    codigoActual.length > 0 &&
    !codigoActual.startsWith(`${codigoPadre}.`);

  const onSubmit = handleSubmit((data) => {
    const payload = { ...data };
    if (!esEdicion) payload.codigoCuenta = codigoAuto;
    if (esPrincipal) {
      payload.codigoCuenta = cuenta.codigoCuenta;
      payload.nombreCuenta = cuenta.nombreCuenta;
    }
    startTransition(async () => {
      const result = esEdicion
        ? await editarCuentaAction(empresaId, cuenta.id, payload)
        : await crearCuentaAction(empresaId, payload);
      if (result.ok) {
        toast.success(esEdicion ? "Cuenta actualizada" : "Cuenta creada");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  });

  // Un padre válido: no es esta cuenta y no está ya en el nivel máximo (no puede tener hijas).
  const opcionesPadre = cuentas.filter(
    (c) =>
      c.id !== cuenta?.id &&
      profundidadDeCuenta(cuentas, c.id) < MAX_PROFUNDIDAD_CUENTA,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? "Las cuentas con padre heredan la clase de su cuenta raíz."
              : "El código se asigna automáticamente."}
            {esPrincipal && " Es una cuenta principal: código y nombre no se pueden modificar."}
            {bloqueado && " Esta cuenta ya tiene movimientos: clase y moneda quedan bloqueadas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <div className="space-y-2">
              <Label htmlFor="codigoCuenta">Código</Label>
              {esEdicion ? (
                <Input id="codigoCuenta" {...register("codigoCuenta")} disabled={esPrincipal} />
              ) : (
                <Input id="codigoCuenta" value={codigoAuto} readOnly disabled />
              )}
              {errors.codigoCuenta && (
                <p className="text-sm text-destructive">{errors.codigoCuenta.message}</p>
              )}
              {!errors.codigoCuenta && prefijoInvalido && (
                <p className="text-sm text-destructive">
                  El código debe empezar con {codigoPadre}. (código de la cuenta padre).
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombreCuenta">Nombre</Label>
              <Input id="nombreCuenta" {...register("nombreCuenta")} disabled={esPrincipal} />
              {errors.nombreCuenta && (
                <p className="text-sm text-destructive">{errors.nombreCuenta.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cuentaPadreId">Cuenta padre</Label>
            <Select
              value={cuentaPadreId ?? SIN_PADRE}
              onValueChange={(value) => {
                if (value === SIN_PADRE) {
                  setValue("cuentaPadreId", undefined);
                  return;
                }
                setValue("cuentaPadreId", value);
                const padre = cuentas.find((c) => c.id === value);
                if (padre) {
                  setValue("clase", padre.clase as FormValues["clase"]);
                  setValue("naturaleza", naturalezaSugerida(padre.clase as ClaseCuenta));
                }
              }}
            >
              <SelectTrigger id="cuentaPadreId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_PADRE}>Sin padre (cuenta raíz)</SelectItem>
                {opcionesPadre.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.codigoCuenta} — {c.nombreCuenta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="clase">Clase</Label>
              <Select
                value={watch("clase")}
                onValueChange={(value) => {
                  setValue("clase", value as FormValues["clase"]);
                  setValue("naturaleza", naturalezaSugerida(value as ClaseCuenta));
                }}
              >
                <SelectTrigger id="clase" className="w-full" disabled={tienePadre || bloqueado}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASE_CUENTA.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tienePadre && (
                <p className="text-xs text-muted-foreground">Heredada de la raíz.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="naturaleza">Naturaleza</Label>
              <Select
                value={watch("naturaleza")}
                onValueChange={(value) =>
                  setValue("naturaleza", value as FormValues["naturaleza"])
                }
              >
                <SelectTrigger id="naturaleza" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NATURALEZA_CUENTA.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clasificacionCorriente">Clasificación</Label>
              <Select
                value={watch("clasificacionCorriente")}
                onValueChange={(value) =>
                  setValue(
                    "clasificacionCorriente",
                    value as FormValues["clasificacionCorriente"],
                  )
                }
              >
                <SelectTrigger id="clasificacionCorriente" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASIFICACION_CORRIENTE.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Modo de moneda</Label>
              <Select
                value={modoMoneda}
                onValueChange={(v) => setValue("modoMoneda", v as FormValues["modoMoneda"])}
              >
                <SelectTrigger className="w-full" disabled={bloqueado}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modosMoneda.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {modoMoneda === "Extranjera fija" && (
              <div className="space-y-2">
                <Label>Moneda fija</Label>
                <Select
                  value={(watch("monedaFijaId") as string | undefined) ?? SIN_MONEDA}
                  onValueChange={(v) =>
                    setValue("monedaFijaId", (v === SIN_MONEDA ? undefined : v) as never)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige la moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_MONEDA}>—</SelectItem>
                    {monedas.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.monedaFijaId && (
                  <p className="text-sm text-destructive">{errors.monedaFijaId.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="tipoCuenta">Tipo de cuenta</Label>
            <Select
              value={watch("tipoCuenta")}
              onValueChange={(value) =>
                setValue("tipoCuenta", value as FormValues["tipoCuenta"])
              }
            >
              <SelectTrigger id="tipoCuenta" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_CUENTA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {FLAGS.map(([name, label]) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  disabled={name === "requiereAnalisisTerceros" && bloqueado}
                  {...register(name)}
                />
                {label}
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || prefijoInvalido}>
              {isPending ? "Guardando..." : esEdicion ? "Guardar" : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function valoresDe(cuenta: CuentaLite | null, padreInicial?: CuentaLite | null): FormValues {
  // Alta de una cuenta hija: hereda clase del padre y sugiere naturaleza. El código
  // se resuelve automático en el componente (no se escribe a mano).
  const claseAlta = padreInicial
    ? (padreInicial.clase as FormValues["clase"])
    : CLASE_CUENTA[0];
  const naturalezaAlta = padreInicial
    ? naturalezaSugerida(padreInicial.clase as ClaseCuenta)
    : NATURALEZA_CUENTA[0];

  return {
    codigoCuenta: cuenta?.codigoCuenta ?? "",
    nombreCuenta: cuenta?.nombreCuenta ?? "",
    cuentaPadreId: cuenta?.cuentaPadreId ?? padreInicial?.id ?? undefined,
    clase: (cuenta?.clase as FormValues["clase"]) ?? claseAlta,
    naturaleza: (cuenta?.naturaleza as FormValues["naturaleza"]) ?? naturalezaAlta,
    tipoCuenta: (cuenta?.tipoCuenta as FormValues["tipoCuenta"]) ?? "Otra",
    clasificacionCorriente:
      (cuenta?.clasificacionCorriente as FormValues["clasificacionCorriente"]) ?? "No Aplica",
    nivelImputable: cuenta?.nivelImputable ?? true,
    requiereCentroCosto: cuenta?.requiereCentroCosto ?? false,
    requiereAnalisisTerceros: cuenta?.requiereAnalisisTerceros ?? false,
    modoMoneda: (cuenta?.modoMoneda as FormValues["modoMoneda"]) ?? "Funcional",
    monedaFijaId: cuenta?.monedaFijaId ?? undefined,
    relevanteFlujoCaja: cuenta?.relevanteFlujoCaja ?? false,
    esCuentaAjuste: cuenta?.esCuentaAjuste ?? false,
    activa: cuenta?.activa ?? true,
  };
}
