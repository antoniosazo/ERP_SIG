"use client";

import { useState, useTransition } from "react";
import { ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import {
  registrarAceptacionReclamoAction,
  verEventosDocumentoCompraAction,
} from "@/lib/actions/sii";
import type { AccionDte, EventoDte } from "@/lib/sii/reclamo-dte";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ACCIONES: Array<{ accion: AccionDte; label: string; confirmacion: string }> = [
  {
    accion: "ACD",
    label: "Aceptar contenido",
    confirmacion: "¿Registrar ante el SII la aceptación de esta factura?",
  },
  {
    accion: "RCD",
    label: "Reclamar contenido",
    confirmacion: "¿Registrar ante el SII un reclamo al contenido de esta factura?",
  },
  {
    accion: "RFP",
    label: "Reclamar falta parcial",
    confirmacion: "¿Registrar ante el SII un reclamo por falta parcial de mercadería?",
  },
  {
    accion: "RFT",
    label: "Reclamar falta total",
    confirmacion: "¿Registrar ante el SII un reclamo por falta total de mercadería?",
  },
];

/**
 * Aceptación/Reclamo de la factura ante el SII (Ley 19.983, Web Service oficial) — no
 * cambia el estado del documento en este sistema, solo notifica al SII.
 */
export function ReclamoSiiDialog({
  empresaId,
  docId,
}: {
  empresaId: string;
  docId: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [eventos, setEventos] = useState<EventoDte[] | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPendingAccion, startTransitionAccion] = useTransition();

  function cargarEventos() {
    setEventos(null);
    setMensaje(null);
    startTransition(async () => {
      const r = await verEventosDocumentoCompraAction(empresaId, docId);
      if (r.ok) {
        setEventos(r.eventos);
        setMensaje(r.mensaje);
      } else {
        setMensaje(null);
        toast.error(r.error);
      }
    });
  }

  function abrir() {
    setAbierto(true);
    cargarEventos();
  }

  function ejecutar(accion: AccionDte, confirmacion: string) {
    if (!confirm(confirmacion)) return;
    startTransitionAccion(async () => {
      const r = await registrarAceptacionReclamoAction(empresaId, docId, accion);
      if (r.ok) {
        toast.success(r.detalle);
        cargarEventos();
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={abrir}
        title="Aceptación / Reclamo SII"
        aria-label="Aceptación / Reclamo SII"
      >
        <ShieldCheckIcon />
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aceptación / Reclamo ante el SII</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Ley 19.983: si no reclamas dentro de 8 días corridos desde que el SII recibió el
            documento, se presume aceptado. Esto notifica al SII — no cambia el estado del
            documento en este sistema.
          </p>

          <div className="flex flex-wrap gap-2">
            {ACCIONES.map((a) => (
              <Button
                key={a.accion}
                type="button"
                variant="outline"
                size="sm"
                disabled={isPendingAccion}
                onClick={() => ejecutar(a.accion, a.confirmacion)}
              >
                {a.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Historial registrado en el SII
            </p>
            {isPending && <p className="text-sm text-muted-foreground">Consultando…</p>}
            {!isPending && eventos && eventos.length === 0 && (
              <p className="text-sm text-muted-foreground">{mensaje ?? "Sin eventos registrados."}</p>
            )}
            {!isPending && eventos && eventos.length > 0 && (
              <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Responsable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventos.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {e.fechaEvento}
                        </TableCell>
                        <TableCell>{e.descEvento || e.codEvento}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {e.rutResponsable}-{e.dvResponsable}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
