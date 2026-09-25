"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { CUENTA_BANCARIA_TIPO, crearCuentaBancariaEmpresaSchema } from "@erp/shared";
import { guardarCuentaBancariaAction } from "@/lib/actions/tesoreria";
import { MontoInput } from "@/components/panel/monto-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type CuentaBancariaFila = {
  id: string;
  bancoId: string;
  bancoNombre: string;
  tipoCuenta: string;
  numeroCuenta: string;
  alias: string | null;
  monedaId: string;
  monedaCodigo: string;
  cuentaContableId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  activa: boolean;
  saldoInicialConciliado: string;
  fechaSaldoInicial: string | null;
};
type Opcion = { id: string; label: string };
type FormValues = z.input<typeof crearCuentaBancariaEmpresaSchema>;

function valoresDe(c: CuentaBancariaFila | null, monedaDefault: string | undefined): FormValues {
  return {
    bancoId: c?.bancoId ?? "",
    tipoCuenta: (c?.tipoCuenta as FormValues["tipoCuenta"]) ?? "Corriente",
    numeroCuenta: c?.numeroCuenta ?? "",
    alias: c?.alias ?? "",
    monedaId: c?.monedaId ?? monedaDefault ?? "",
    cuentaContableId: c?.cuentaContableId ?? "",
    activa: c?.activa ?? true,
    saldoInicialConciliado: c ? Number(c.saldoInicialConciliado) : 0,
    fechaSaldoInicial: c?.fechaSaldoInicial ?? "",
  };
}

export function CuentasBancariasManager({
  empresaId,
  cuentas,
  bancos,
  monedas,
  cuentasContables,
}: {
  empresaId: string;
  cuentas: CuentaBancariaFila[];
  bancos: Opcion[];
  monedas: Opcion[];
  cuentasContables: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<CuentaBancariaFila | null>(null);
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearCuentaBancariaEmpresaSchema),
    defaultValues: valoresDe(null, monedas[0]?.id),
  });
  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion, monedas[0]?.id));
  }, [abierto, enEdicion, reset, monedas]);

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = await guardarCuentaBancariaAction(empresaId, enEdicion?.id ?? null, data);
      if (r.ok) {
        toast.success(enEdicion ? "Cuenta actualizada" : "Cuenta creada");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  });

  const selectCampo = (
    id: keyof FormValues,
    etiqueta: string,
    opciones: Opcion[],
    placeholder: string,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Select value={(watch(id) as string) || undefined} onValueChange={(v) => setValue(id, v as never, { shouldValidate: true })}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errors[id] && <p className="text-sm text-destructive">{errors[id]?.message as string}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEnEdicion(null);
            setAbierto(true);
          }}
        >
          Nueva cuenta bancaria
        </Button>
      </div>

      {cuentas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta empresa no tiene cuentas bancarias. Créalas para poder registrar transferencias y cheques.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Cuenta contable</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuentas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.bancoNombre}</TableCell>
                  <TableCell>
                    <div className="font-mono">{c.numeroCuenta}</div>
                    {c.alias && <div className="text-xs text-muted-foreground">{c.alias}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.tipoCuenta}</TableCell>
                  <TableCell>{c.monedaCodigo}</TableCell>
                  <TableCell>
                    <span className="font-mono text-muted-foreground">{c.cuentaCodigo}</span> {c.cuentaNombre}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.activa ? "default" : "secondary"}>{c.activa ? "Activa" : "Inactiva"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
            <DialogTitle>{enEdicion ? "Editar cuenta bancaria" : "Nueva cuenta bancaria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            {selectCampo("bancoId", "Banco", bancos, "Selecciona un banco")}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipoCuenta">Tipo de cuenta</Label>
                <Select value={watch("tipoCuenta")} onValueChange={(v) => setValue("tipoCuenta", v as FormValues["tipoCuenta"])}>
                  <SelectTrigger id="tipoCuenta" className="w-full">
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
                <Label htmlFor="numeroCuenta">Número de cuenta</Label>
                <Input id="numeroCuenta" {...register("numeroCuenta")} />
                {errors.numeroCuenta && <p className="text-sm text-destructive">{errors.numeroCuenta.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alias">Alias (opcional)</Label>
              <Input id="alias" placeholder="Ej. Cuenta corriente principal" {...register("alias")} />
            </div>
            {selectCampo("monedaId", "Moneda", monedas, "Moneda")}
            {selectCampo("cuentaContableId", "Cuenta contable (tipo Banco)", cuentasContables, "Cuenta contable")}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="saldoInicialConciliado">Saldo inicial conciliado</Label>
                <MontoInput
                  valor={watch("saldoInicialConciliado") ?? 0}
                  onValorChange={(v) => setValue("saldoInicialConciliado", v)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaSaldoInicial">Fecha del saldo inicial</Label>
                <Input id="fechaSaldoInicial" type="date" {...register("fechaSaldoInicial")} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Punto de partida de la primera conciliación bancaria de esta cuenta.
            </p>
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="activa">Estado</Label>
              <Select value={watch("activa") ? "1" : "0"} onValueChange={(v) => setValue("activa", v === "1")}>
                <SelectTrigger id="activa" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Activa</SelectItem>
                  <SelectItem value="0">Inactiva</SelectItem>
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
    </div>
  );
}
