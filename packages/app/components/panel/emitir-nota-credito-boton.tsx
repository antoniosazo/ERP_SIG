"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { emitirNotaCreditoDesdeFacturaAction } from "@/lib/actions/ventas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MontoInput } from "@/components/panel/monto-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Opcion = { id: string; label: string };

/** Botón en el detalle de una factura contabilizada: emite una NC por el saldo disponible. */
export function EmitirNotaCreditoBoton({
  empresaId,
  facturaId,
  saldo,
  tiposNC,
}: {
  empresaId: string;
  facturaId: string;
  saldo: number;
  tiposNC: Opcion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [tipoDocumentoId, setTipoDocumentoId] = useState(tiposNC[0]?.id ?? "");
  const [monto, setMonto] = useState(saldo);

  if (saldo <= 0.01) {
    return (
      <Button type="button" variant="secondary" disabled>
        Sin saldo para nota de crédito
      </Button>
    );
  }

  function emitir() {
    if (!tipoDocumentoId) {
      toast.error("Elige el tipo de documento.");
      return;
    }
    if (!(monto > 0) || monto > saldo + 0.01) {
      toast.error("El monto debe ser mayor que cero y no superar el saldo disponible.");
      return;
    }
    startTransition(async () => {
      const r = await emitirNotaCreditoDesdeFacturaAction(empresaId, facturaId, tipoDocumentoId, monto);
      if (r.ok) {
        setAbierto(false);
        router.push(`/panel/${empresaId}/ventas/documentos/${r.docId}`);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setAbierto(true)}>
        Emitir nota de crédito
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir nota de crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se creará una nota de crédito en borrador referenciando esta factura. Las líneas
              se ajustarán proporcionalmente al monto indicado y podrás revisarlas antes de contabilizar.
              Saldo disponible: {saldo.toLocaleString("es-CL")}.
            </p>
            <div className="space-y-2">
              <Label>Monto de la nota de crédito</Label>
              <MontoInput valor={monto} onValorChange={setMonto} />
              {monto > saldo + 0.01 && <p className="text-sm text-destructive">El monto supera el saldo disponible.</p>}
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento (SII)</Label>
              <Select value={tipoDocumentoId} onValueChange={setTipoDocumentoId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposNC.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={emitir} disabled={isPending || !tipoDocumentoId || !(monto > 0) || monto > saldo + 0.01}>
              {isPending ? "Emitiendo..." : "Emitir y abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
