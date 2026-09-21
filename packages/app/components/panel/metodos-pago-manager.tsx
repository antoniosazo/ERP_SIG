"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { METODO_PAGO_SENTIDO, METODO_PAGO_TIPO, crearMetodoPagoSchema } from "@erp/shared";
import { guardarMetodoPagoAction } from "@/lib/actions/tesoreria";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type MetodoPagoFila = {
  id: string;
  nombre: string;
  tipo: string;
  sentido: string;
  cuentaBancariaId: string | null;
  cuentaContableId: string | null;
  activo: boolean;
};
type Opcion = { id: string; label: string };
type FormValues = z.input<typeof crearMetodoPagoSchema>;
const NINGUNA = "__none__";

function valoresDe(m: MetodoPagoFila | null): FormValues {
  return {
    nombre: m?.nombre ?? "",
    tipo: (m?.tipo as FormValues["tipo"]) ?? "Transferencia",
    sentido: (m?.sentido as FormValues["sentido"]) ?? "Ambos",
    cuentaBancariaId: m?.cuentaBancariaId ?? undefined,
    cuentaContableId: m?.cuentaContableId ?? undefined,
    activo: m?.activo ?? true,
  };
}

export function MetodosPagoManager({
  empresaId,
  metodos,
  cuentasBancarias,
  cuentasContables,
}: {
  empresaId: string;
  metodos: MetodoPagoFila[];
  cuentasBancarias: Opcion[];
  cuentasContables: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<MetodoPagoFila | null>(null);
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearMetodoPagoSchema),
    defaultValues: valoresDe(null),
  });
  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion));
  }, [abierto, enEdicion, reset]);

  const nombreCuentaBancaria = new Map(cuentasBancarias.map((c) => [c.id, c.label]));
  const nombreCuenta = new Map(cuentasContables.map((c) => [c.id, c.label]));
  const tipo = watch("tipo");

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = await guardarMetodoPagoAction(empresaId, enEdicion?.id ?? null, data);
      if (r.ok) {
        toast.success(enEdicion ? "Método de pago actualizado" : "Método de pago creado");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
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
          Nuevo método de pago
        </Button>
      </div>

      {metodos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta empresa no tiene métodos de pago. Define al menos uno para poder registrar cobros y pagos.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Sentido</TableHead>
                <TableHead>Cuenta bancaria</TableHead>
                <TableHead>Cuenta contable</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metodos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nombre}</TableCell>
                  <TableCell>{m.tipo}</TableCell>
                  <TableCell className="text-muted-foreground">{m.sentido}</TableCell>
                  <TableCell>{m.cuentaBancariaId ? (nombreCuentaBancaria.get(m.cuentaBancariaId) ?? "—") : "—"}</TableCell>
                  <TableCell>{m.cuentaContableId ? (nombreCuenta.get(m.cuentaContableId) ?? "—") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={m.activo ? "default" : "secondary"}>{m.activo ? "Activo" : "Inactivo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEnEdicion(m);
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
            <DialogTitle>{enEdicion ? "Editar método de pago" : "Nuevo método de pago"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" placeholder="Ej. Transferencia Banco de Chile" {...register("nombre")} />
              {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setValue("tipo", v as FormValues["tipo"], { shouldValidate: true })}>
                  <SelectTrigger id="tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METODO_PAGO_TIPO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sentido">Sirve para</Label>
                <Select value={watch("sentido")} onValueChange={(v) => setValue("sentido", v as FormValues["sentido"])}>
                  <SelectTrigger id="sentido" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METODO_PAGO_SENTIDO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "Recibido" ? "Cobros (pagos recibidos)" : t === "Efectuado" ? "Pagos (pagos efectuados)" : "Ambos"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cuentaBancariaId">Cuenta bancaria{tipo === "Transferencia" ? "" : " (opcional)"}</Label>
              <Select
                value={watch("cuentaBancariaId") ?? NINGUNA}
                onValueChange={(v) => setValue("cuentaBancariaId", v === NINGUNA ? undefined : v, { shouldValidate: true })}
              >
                <SelectTrigger id="cuentaBancariaId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NINGUNA}>Sin cuenta bancaria</SelectItem>
                  {cuentasBancarias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cuentaBancariaId && <p className="text-sm text-destructive">{errors.cuentaBancariaId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cuentaContableId">
                Cuenta contable {tipo === "Efectivo" ? "(Caja)" : "(opcional: caja o cuenta transitoria)"}
              </Label>
              <Select
                value={watch("cuentaContableId") ?? NINGUNA}
                onValueChange={(v) => setValue("cuentaContableId", v === NINGUNA ? undefined : v, { shouldValidate: true })}
              >
                <SelectTrigger id="cuentaContableId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NINGUNA}>Usar la de la cuenta bancaria</SelectItem>
                  {cuentasContables.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cuentaContableId && <p className="text-sm text-destructive">{errors.cuentaContableId.message}</p>}
            </div>
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="activo">Estado</Label>
              <Select value={watch("activo") ? "1" : "0"} onValueChange={(v) => setValue("activo", v === "1")}>
                <SelectTrigger id="activo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Activo</SelectItem>
                  <SelectItem value="0">Inactivo</SelectItem>
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
