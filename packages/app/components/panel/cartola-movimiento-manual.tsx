"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { agregarMovimientoManualAction } from "@/lib/actions/cartolas";
import { MontoInput } from "@/components/panel/monto-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Opcion = { id: string; label: string };

export function CartolaMovimientoManual({ empresaId, cuentas }: { empresaId: string; cuentas: Opcion[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [cuentaBancariaId, setCuentaBancariaId] = useState(cuentas[0]?.id ?? "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [nroDocumento, setNroDocumento] = useState("");
  const [monto, setMonto] = useState(0);

  function guardar() {
    startTransition(async () => {
      const r = await agregarMovimientoManualAction(empresaId, cuentaBancariaId, {
        fecha,
        descripcion,
        monto,
        nroDocumento: nroDocumento || null,
      });
      if (r.ok) {
        toast.success("Movimiento agregado");
        setAbierto(false);
        setDescripcion("");
        setNroDocumento("");
        setMonto(0);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)} disabled={cuentas.length === 0}>
        Movimiento manual
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar movimiento manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mm-cuenta">Cuenta bancaria</Label>
              <Select value={cuentaBancariaId} onValueChange={setCuentaBancariaId}>
                <SelectTrigger id="mm-cuenta" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mm-fecha">Fecha</Label>
                <Input id="mm-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Monto (negativo = cargo)</Label>
                <MontoInput valor={monto} onValorChange={setMonto} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mm-desc">Descripción</Label>
              <Input id="mm-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mm-doc">N° documento (opcional)</Label>
              <Input id="mm-doc" value={nroDocumento} onChange={(e) => setNroDocumento(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={isPending || !descripcion || monto === 0}>
              {isPending ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
