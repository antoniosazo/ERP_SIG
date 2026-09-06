"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DeterminacionContexto, DeterminacionRol } from "@erp/shared";
import { guardarReglaDeterminacionAction } from "@/lib/actions/determinacion-cuentas";
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

type Opcion = { id: string; label: string };
type Regla = { contexto: string; rol: string; cuentaId: string };

const SIN_CUENTA = "__none__";

const FILAS: { contexto: DeterminacionContexto; rol: DeterminacionRol; label: string; ayuda: string }[] = [
  { contexto: "venta", rol: "cuenta_por_cobrar", label: "Cuenta por cobrar (general)", ayuda: "Fallback cuando el cliente no tiene cuenta puente." },
  { contexto: "venta", rol: "ingreso", label: "Ingreso por ventas (general)", ayuda: "Cuenta de ingreso por defecto." },
  { contexto: "venta", rol: "ingreso_exento", label: "Ingreso exento (general)", ayuda: "Ingreso para líneas exentas." },
  { contexto: "venta", rol: "descuento_venta", label: "Descuentos sobre ventas", ayuda: "Contrapartida de descuentos comerciales." },
  { contexto: "compra", rol: "cuenta_por_pagar", label: "Cuenta por pagar (general)", ayuda: "Fallback cuando el proveedor no tiene cuenta puente." },
  { contexto: "compra", rol: "gasto", label: "Gasto de compra por defecto", ayuda: "Cuenta de imputación por defecto para líneas de compra." },
  { contexto: "compra", rol: "inventario", label: "Existencias (general)", ayuda: "Cuenta de cargo de la Entrada de Mercadería." },
  { contexto: "compra", rol: "gr_ir", label: "Cuenta puente GR-IR", ayuda: "Transitorio de pasivo entre la recepción y la factura de compra." },
  { contexto: "impuesto", rol: "iva_debito", label: "IVA débito fiscal", ayuda: "Fallback cuando el impuesto de venta no tiene cuenta asignada." },
  { contexto: "impuesto", rol: "iva_credito", label: "IVA crédito fiscal", ayuda: "Fallback cuando el impuesto de compra no tiene cuenta asignada." },
];

export function DeterminacionCuentasManager({
  empresaId,
  reglas,
  cuentas,
}: {
  empresaId: string;
  reglas: Regla[];
  cuentas: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [guardando, setGuardando] = useState<string | null>(null);

  const actual = new Map(reglas.map((r) => [`${r.contexto}/${r.rol}`, r.cuentaId]));

  function cambiar(contexto: DeterminacionContexto, rol: DeterminacionRol, valor: string) {
    const cuentaId = valor === SIN_CUENTA ? null : valor;
    setGuardando(`${contexto}/${rol}`);
    startTransition(async () => {
      const r = await guardarReglaDeterminacionAction(empresaId, { contexto, rol, cuentaId });
      setGuardando(null);
      if (r.ok) {
        toast.success(cuentaId ? "Regla guardada" : "Regla eliminada");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-72">Rol contable</TableHead>
            <TableHead>Cuenta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {FILAS.map((f) => {
            const clave = `${f.contexto}/${f.rol}`;
            return (
              <TableRow key={clave}>
                <TableCell>
                  <div className="font-medium">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{f.ayuda}</div>
                </TableCell>
                <TableCell>
                  <Select
                    value={actual.get(clave) ?? SIN_CUENTA}
                    onValueChange={(v) => cambiar(f.contexto, f.rol, v)}
                    disabled={isPending && guardando === clave}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Sin regla" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_CUENTA}>Sin regla</SelectItem>
                      {cuentas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
