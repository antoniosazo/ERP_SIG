"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { LockKeyholeIcon } from "lucide-react";
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
import { descendientesCuenta, valoresDe } from "@/lib/plan-cuentas-vista";
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
  const descendientes = descendientesCuenta(cuentas, cuenta?.id);
  const claseBloqueada = cuentas.some((c) => descendientes.has(c.id) && c.tieneMovimientos);
  const esPrincipal = esEdicion && cuenta.cuentaPadreId === null;
  const esPadre = esEdicion && cuentas.some((c) => c.cuentaPadreId === cuenta.id);
  const estructuraBloqueada = esPrincipal || (esPadre && claseBloqueada);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(crearCuentaSchema),
    defaultValues: valoresDe(cuentas, cuenta, padreInicial),
  });

  useEffect(() => {
    if (open) reset(valoresDe(cuentas, cuenta, padreInicial));
  }, [open, cuentas, cuenta, padreInicial, reset]);

  const valores = useWatch({ control });
  const cuentaPadreId = valores.cuentaPadreId;
  const tienePadre = !!cuentaPadreId;
  const modoMoneda = valores.modoMoneda;
  const codigoActual = (valores.codigoCuenta ?? "").trim();

  const modosMoneda = CUENTA_MODO_MONEDA.filter((m) => m !== "Local" || modoMoneda === "Local");

  const padreSel = cuentaPadreId ? cuentas.find((c) => c.id === cuentaPadreId) : undefined;
  const codigoPadre = padreSel?.codigoCuenta;

  const prefijoInvalido =
    esEdicion &&
    !esPrincipal &&
    !!codigoPadre &&
    codigoActual.length > 0 &&
    !codigoActual.startsWith(`${codigoPadre}.`);

  const onSubmit = handleSubmit((data) => {
    if (esPrincipal) return;
    const payload = { ...data };
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
      !descendientes.has(c.id) &&
      profundidadDeCuenta(cuentas, c.id) < MAX_PROFUNDIDAD_CUENTA,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {esPrincipal && <LockKeyholeIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
            {esPrincipal ? "Ver configuración" : esEdicion ? "Editar cuenta" : "Nueva cuenta"}
          </DialogTitle>
          <DialogDescription>
            {esPrincipal
              ? "Cuenta principal protegida. Su configuración es de solo lectura; puedes crear subcuentas desde el plan de cuentas."
              : esEdicion
                ? "Las cuentas con padre heredan la clase de su cuenta raíz."
                : "El código se asigna automáticamente."}
            {!esPrincipal && estructuraBloqueada && " Esta cuenta o sus descendientes tienen movimientos: código, cuenta padre y clase están bloqueados. Puedes modificar el nombre."}
            {!esPrincipal && bloqueado && " Esta cuenta tiene movimientos: tampoco se pueden cambiar la moneda ni el control de terceros."}
            {esPadre && !estructuraBloqueada && " Cambiar el código renumera también sus cuentas hijas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <div className="space-y-2">
              <Label htmlFor="codigoCuenta">Código</Label>
              <Input id="codigoCuenta" {...register("codigoCuenta")} readOnly={!esEdicion || estructuraBloqueada} />
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
              <Input id="nombreCuenta" {...register("nombreCuenta")} readOnly={esPrincipal} />
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
                  if (!esEdicion) setValue("codigoCuenta", siguienteCodigoRaiz(cuentas), { shouldValidate: true });
                  return;
                }
                setValue("cuentaPadreId", value);
                const padre = cuentas.find((c) => c.id === value);
                if (padre) {
                  if (!esEdicion) setValue("codigoCuenta", siguienteCodigoHijo(padre, cuentas), { shouldValidate: true });
                  setValue("clase", padre.clase as FormValues["clase"]);
                  setValue("naturaleza", naturalezaSugerida(padre.clase as ClaseCuenta));
                }
              }}
            >
              <SelectTrigger id="cuentaPadreId" className="w-full" disabled={estructuraBloqueada}>
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
                value={valores.clase}
                onValueChange={(value) => {
                  setValue("clase", value as FormValues["clase"]);
                  setValue("naturaleza", naturalezaSugerida(value as ClaseCuenta));
                }}
              >
                <SelectTrigger id="clase" className="w-full" disabled={esPrincipal || tienePadre || claseBloqueada}>
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
                value={valores.naturaleza}
                onValueChange={(value) =>
                  setValue("naturaleza", value as FormValues["naturaleza"])
                }
              >
                <SelectTrigger id="naturaleza" className="w-full" disabled={esPrincipal}>
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
                value={valores.clasificacionCorriente}
                onValueChange={(value) =>
                  setValue(
                    "clasificacionCorriente",
                    value as FormValues["clasificacionCorriente"],
                  )
                }
              >
                <SelectTrigger id="clasificacionCorriente" className="w-full" disabled={esPrincipal}>
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
                <SelectTrigger className="w-full" disabled={esPrincipal || bloqueado}>
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
                  value={(valores.monedaFijaId as string | undefined) ?? SIN_MONEDA}
                  onValueChange={(v) =>
                    setValue("monedaFijaId", (v === SIN_MONEDA ? undefined : v) as never)
                  }
                >
                  <SelectTrigger className="w-full" disabled={esPrincipal || bloqueado}>
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
              value={valores.tipoCuenta}
              onValueChange={(value) =>
                setValue("tipoCuenta", value as FormValues["tipoCuenta"])
              }
            >
              <SelectTrigger id="tipoCuenta" className="w-full" disabled={esPrincipal}>
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
                  disabled={esPrincipal || (name === "requiereAnalisisTerceros" && bloqueado)}
                  {...register(name)}
                />
                {label}
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {esPrincipal ? "Cerrar" : "Cancelar"}
            </Button>
            {!esPrincipal && <Button type="submit" disabled={isPending || prefijoInvalido}>
              {isPending ? "Guardando..." : esEdicion ? "Guardar" : "Crear cuenta"}
            </Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
