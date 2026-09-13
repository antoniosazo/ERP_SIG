"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { crearProductoGrupoSchema } from "@erp/shared";
import {
  crearProductoGrupoAction,
  editarProductoGrupoAction,
} from "@/lib/actions/productos-grupos";
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
import { IrACuenta } from "./ir-a-cuenta";

export type Opcion = { id: string; label: string };
export type GrupoLite = {
  id: string;
  nombre: string;
  cuentaIngresoDefaultId: string | null;
  impuestoDefaultId: string | null;
  centroCostoDefaultId: string | null;
  categoriaContableDefaultId: string | null;
  cuentaInventarioDefaultId: string | null;
  cuentaCostoVentaDefaultId: string | null;
  cuentaGastoCompraDefaultId: string | null;
  impuestoCompraDefaultId: string | null;
  // Resto de cuentas de determinación — ver nota en el schema de productos_grupos.
  cuentaDotacionDefaultId: string | null;
  cuentaDesviacionDefaultId: string | null;
  cuentaDiferenciaPrecioDefaultId: string | null;
  cuentaAjusteStockNegativoDefaultId: string | null;
  cuentaCompensacionStockReduccionDefaultId: string | null;
  cuentaCompensacionStockAumentoDefaultId: string | null;
  cuentaDevolucionVentaDefaultId: string | null;
  cuentaIngresoExtranjeroDefaultId: string | null;
  cuentaCostoExtranjeroDefaultId: string | null;
  cuentaDiferenciaCambioDefaultId: string | null;
  cuentaCompensacionMercaderiaDefaultId: string | null;
  cuentaReduccionLibroMayorDefaultId: string | null;
  cuentaAumentoLibroMayorDefaultId: string | null;
  cuentaStockWipDefaultId: string | null;
  cuentaDesviacionStockWipDefaultId: string | null;
  cuentaPygCompensacionWipDefaultId: string | null;
  cuentaPygCompensacionStockDefaultId: string | null;
};

type FormValues = z.input<typeof crearProductoGrupoSchema>;
const NINGUNA = "__none__";

export function ProductosGruposManager({
  empresaId,
  grupos,
  cuentas,
  impuestos,
  centrosCosto,
  categorias,
}: {
  empresaId: string;
  grupos: GrupoLite[];
  cuentas: Opcion[];
  impuestos: Opcion[];
  centrosCosto: Opcion[];
  categorias: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<GrupoLite | null>(null);

  const { handleSubmit, register, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearProductoGrupoSchema),
    defaultValues: valoresDe(null),
  });

  useEffect(() => {
    if (abierto) reset(valoresDe(enEdicion));
  }, [abierto, enEdicion, reset]);

  const nom = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of [...cuentas, ...impuestos, ...centrosCosto, ...categorias]) m.set(o.id, o.label);
    return m;
  }, [cuentas, impuestos, centrosCosto, categorias]);

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = enEdicion
        ? await editarProductoGrupoAction(empresaId, enEdicion.id, data)
        : await crearProductoGrupoAction(empresaId, data);
      if (r.ok) {
        toast.success(enEdicion ? "Grupo actualizado" : "Grupo creado");
        setAbierto(false);
        router.refresh();
      } else toast.error(r.error);
    });
  });

  const sel = (
    name: Exclude<keyof FormValues, "nombre">,
    label: string,
    opciones: Opcion[],
    placeholder: string,
    esCuenta = false,
  ) => {
    const valor = watch(name) as string | undefined;
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <Select
            value={valor ?? NINGUNA}
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
          {esCuenta && <IrACuenta empresaId={empresaId} cuentaId={valor} />}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEnEdicion(null);
            setAbierto(true);
          }}
        >
          Nuevo grupo
        </Button>
      </div>

      {grupos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta empresa no tiene grupos de productos.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cuenta de ingreso</TableHead>
                <TableHead>Impuesto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {g.cuentaIngresoDefaultId ? (nom.get(g.cuentaIngresoDefaultId) ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {g.impuestoDefaultId ? (nom.get(g.impuestoDefaultId) ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEnEdicion(g);
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{enEdicion ? "Editar grupo" : "Nuevo grupo de productos"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
            </div>
            <p className="text-xs font-medium text-muted-foreground">Venta</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {sel("cuentaIngresoDefaultId", "Cuenta de ingreso por defecto", cuentas, "Sin cuenta", true)}
              {sel("impuestoDefaultId", "Impuesto por defecto", impuestos, "Sin impuesto")}
              {sel("centroCostoDefaultId", "Centro de costo por defecto", centrosCosto, "Sin centro de costo")}
              {sel("categoriaContableDefaultId", "Categoría contable por defecto", categorias, "Sin categoría")}
            </div>

            <p className="text-xs font-medium text-muted-foreground">Compra / Inventario</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {sel("cuentaInventarioDefaultId", "Cuenta de existencias (inventario)", cuentas, "Sin cuenta", true)}
              {sel("cuentaCostoVentaDefaultId", "Cuenta de costo de venta", cuentas, "Sin cuenta", true)}
              {sel("cuentaGastoCompraDefaultId", "Cuenta de gasto de compra", cuentas, "Sin cuenta", true)}
              {sel("impuestoCompraDefaultId", "Impuesto de compra por defecto", impuestos, "Sin impuesto")}
            </div>

            <details className="rounded-lg ring-1 ring-foreground/10">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
                Resto de cuentas — sin lógica de posteo todavía, solo se guardan
              </summary>
              <div className="space-y-4 border-t px-3 py-4">
                <p className="text-xs font-medium text-muted-foreground">Ajustes de inventario</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {sel("cuentaDotacionDefaultId", "Cuenta de dotación", cuentas, "Sin cuenta", true)}
                  {sel("cuentaDesviacionDefaultId", "Cuenta de desviación", cuentas, "Sin cuenta", true)}
                  {sel("cuentaDiferenciaPrecioDefaultId", "Cuenta de diferencias de precio", cuentas, "Sin cuenta", true)}
                  {sel("cuentaAjusteStockNegativoDefaultId", "Cuenta de ajuste de stock negativo", cuentas, "Sin cuenta", true)}
                  {sel("cuentaCompensacionStockReduccionDefaultId", "Compensación de stocks — reducción", cuentas, "Sin cuenta", true)}
                  {sel("cuentaCompensacionStockAumentoDefaultId", "Compensación de stocks — aumento", cuentas, "Sin cuenta", true)}
                </div>

                <p className="text-xs font-medium text-muted-foreground">Devoluciones y moneda extranjera</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {sel("cuentaDevolucionVentaDefaultId", "Cuenta de devoluciones por ventas", cuentas, "Sin cuenta", true)}
                  {sel("cuentaIngresoExtranjeroDefaultId", "Cuenta de ingresos — extranjero", cuentas, "Sin cuenta", true)}
                  {sel("cuentaCostoExtranjeroDefaultId", "Cuenta de costos — extranjero", cuentas, "Sin cuenta", true)}
                  {sel("cuentaDiferenciaCambioDefaultId", "Cuenta de diferencias de tipo de cambio", cuentas, "Sin cuenta", true)}
                </div>

                <p className="text-xs font-medium text-muted-foreground">Otros ajustes de mercancías</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {sel("cuentaCompensacionMercaderiaDefaultId", "Cuenta compensación mercancías", cuentas, "Sin cuenta", true)}
                  {sel("cuentaReduccionLibroMayorDefaultId", "Cuenta de reducción del libro mayor", cuentas, "Sin cuenta", true)}
                  {sel("cuentaAumentoLibroMayorDefaultId", "Cuenta de aumento del libro mayor", cuentas, "Sin cuenta", true)}
                </div>

                <p className="text-xs font-medium text-muted-foreground">Trabajo en curso (WIP)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {sel("cuentaStockWipDefaultId", "Cuenta de stocks de trabajo en curso", cuentas, "Sin cuenta", true)}
                  {sel("cuentaDesviacionStockWipDefaultId", "Cuenta de desviación de stock WIP", cuentas, "Sin cuenta", true)}
                  {sel("cuentaPygCompensacionWipDefaultId", "Cuenta PyG de compensación WIP", cuentas, "Sin cuenta", true)}
                  {sel("cuentaPygCompensacionStockDefaultId", "Cuenta PyG de compensación de stocks", cuentas, "Sin cuenta", true)}
                </div>
              </div>
            </details>
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

function valoresDe(g: GrupoLite | null): FormValues {
  return {
    nombre: g?.nombre ?? "",
    cuentaIngresoDefaultId: g?.cuentaIngresoDefaultId ?? undefined,
    impuestoDefaultId: g?.impuestoDefaultId ?? undefined,
    centroCostoDefaultId: g?.centroCostoDefaultId ?? undefined,
    categoriaContableDefaultId: g?.categoriaContableDefaultId ?? undefined,
    cuentaInventarioDefaultId: g?.cuentaInventarioDefaultId ?? undefined,
    cuentaCostoVentaDefaultId: g?.cuentaCostoVentaDefaultId ?? undefined,
    cuentaGastoCompraDefaultId: g?.cuentaGastoCompraDefaultId ?? undefined,
    impuestoCompraDefaultId: g?.impuestoCompraDefaultId ?? undefined,
    cuentaDotacionDefaultId: g?.cuentaDotacionDefaultId ?? undefined,
    cuentaDesviacionDefaultId: g?.cuentaDesviacionDefaultId ?? undefined,
    cuentaDiferenciaPrecioDefaultId: g?.cuentaDiferenciaPrecioDefaultId ?? undefined,
    cuentaAjusteStockNegativoDefaultId: g?.cuentaAjusteStockNegativoDefaultId ?? undefined,
    cuentaCompensacionStockReduccionDefaultId: g?.cuentaCompensacionStockReduccionDefaultId ?? undefined,
    cuentaCompensacionStockAumentoDefaultId: g?.cuentaCompensacionStockAumentoDefaultId ?? undefined,
    cuentaDevolucionVentaDefaultId: g?.cuentaDevolucionVentaDefaultId ?? undefined,
    cuentaIngresoExtranjeroDefaultId: g?.cuentaIngresoExtranjeroDefaultId ?? undefined,
    cuentaCostoExtranjeroDefaultId: g?.cuentaCostoExtranjeroDefaultId ?? undefined,
    cuentaDiferenciaCambioDefaultId: g?.cuentaDiferenciaCambioDefaultId ?? undefined,
    cuentaCompensacionMercaderiaDefaultId: g?.cuentaCompensacionMercaderiaDefaultId ?? undefined,
    cuentaReduccionLibroMayorDefaultId: g?.cuentaReduccionLibroMayorDefaultId ?? undefined,
    cuentaAumentoLibroMayorDefaultId: g?.cuentaAumentoLibroMayorDefaultId ?? undefined,
    cuentaStockWipDefaultId: g?.cuentaStockWipDefaultId ?? undefined,
    cuentaDesviacionStockWipDefaultId: g?.cuentaDesviacionStockWipDefaultId ?? undefined,
    cuentaPygCompensacionWipDefaultId: g?.cuentaPygCompensacionWipDefaultId ?? undefined,
    cuentaPygCompensacionStockDefaultId: g?.cuentaPygCompensacionStockDefaultId ?? undefined,
  };
}
