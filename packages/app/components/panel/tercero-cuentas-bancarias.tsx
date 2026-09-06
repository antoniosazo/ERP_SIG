"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { CUENTA_BANCARIA_TIPO, crearCuentaBancariaSchema } from "@erp/shared";
import {
  crearCuentaBancariaAction,
  editarCuentaBancariaAction,
  eliminarCuentaBancariaAction,
} from "@/lib/actions/terceros";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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

export type CuentaBancariaLite = {
  id: string;
  bancoId: string;
  tipoCuenta: string;
  numeroCuenta: string;
  titular: string | null;
  rutTitular: string | null;
  esPrincipal: boolean;
};
export type Opcion = { id: string; label: string };
type FormValues = z.input<typeof crearCuentaBancariaSchema>;

export function TerceroCuentasBancarias({
  empresaId,
  terceroId,
  cuentas,
  bancos,
}: {
  empresaId: string;
  terceroId: string;
  cuentas: CuentaBancariaLite[];
  bancos: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [edicion, setEdicion] = useState<CuentaBancariaLite | null>(null);
  const bancoLabel = new Map(bancos.map((b) => [b.id, b.label]));

  const vacio: FormValues = {
    bancoId: bancos[0]?.id ?? "",
    tipoCuenta: CUENTA_BANCARIA_TIPO[0],
    numeroCuenta: "",
    titular: "",
    rutTitular: "",
    esPrincipal: false,
  };

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearCuentaBancariaSchema),
    defaultValues: vacio,
  });

  useEffect(() => {
    if (abierto) reset(edicion ? clean(edicion) : vacio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, edicion, reset]);

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = edicion
        ? await editarCuentaBancariaAction(empresaId, terceroId, edicion.id, data)
        : await crearCuentaBancariaAction(empresaId, terceroId, data);
      if (r.ok) {
        toast.success(edicion ? "Cuenta actualizada" : "Cuenta agregada");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  });

  function borrar(c: CuentaBancariaLite) {
    if (!confirm("¿Eliminar esta cuenta bancaria?")) return;
    startTransition(async () => {
      const r = await eliminarCuentaBancariaAction(empresaId, terceroId, c.id);
      if (r.ok) {
        toast.success("Cuenta eliminada");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Cuentas bancarias</CardTitle>
        <Button
          size="sm"
          disabled={bancos.length === 0}
          onClick={() => {
            setEdicion(null);
            setAbierto(true);
          }}
        >
          Agregar
        </Button>
      </CardHeader>
      {cuentas.length === 0 ? (
        <p className="px-6 pb-2 text-sm text-muted-foreground">Sin cuentas bancarias.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banco</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Titular</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuentas.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {bancoLabel.get(c.bancoId) ?? "—"}
                  {c.esPrincipal && <Badge className="ml-2">Principal</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.tipoCuenta}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{c.numeroCuenta}</TableCell>
                <TableCell className="text-muted-foreground">{c.titular ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEdicion(c);
                      setAbierto(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => borrar(c)}
                  >
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edicion ? "Editar cuenta bancaria" : "Nueva cuenta bancaria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="b-banco">Banco</Label>
                <Select
                  value={watch("bancoId")}
                  onValueChange={(v) => setValue("bancoId", v)}
                >
                  <SelectTrigger id="b-banco" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bancos.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.bancoId && (
                  <p className="text-sm text-destructive">{errors.bancoId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-tipo">Tipo de cuenta</Label>
                <Select
                  value={watch("tipoCuenta")}
                  onValueChange={(v) => setValue("tipoCuenta", v as FormValues["tipoCuenta"])}
                >
                  <SelectTrigger id="b-tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUENTA_BANCARIA_TIPO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-numero">Número de cuenta</Label>
                <Input id="b-numero" {...register("numeroCuenta")} />
                {errors.numeroCuenta && (
                  <p className="text-sm text-destructive">{errors.numeroCuenta.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-titular">Titular</Label>
                <Input id="b-titular" {...register("titular")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-ruttitular">RUT titular</Label>
                <Input id="b-ruttitular" {...register("rutTitular")} />
                {errors.rutTitular && (
                  <p className="text-sm text-destructive">{errors.rutTitular.message}</p>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" {...register("esPrincipal")} /> Cuenta
              principal
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function clean(c: CuentaBancariaLite): FormValues {
  return {
    bancoId: c.bancoId,
    tipoCuenta: c.tipoCuenta as FormValues["tipoCuenta"],
    numeroCuenta: c.numeroCuenta,
    titular: c.titular ?? "",
    rutTitular: c.rutTitular ?? "",
    esPrincipal: c.esPrincipal,
  };
}
