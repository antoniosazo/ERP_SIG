"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  descargarRcvCrudoAction,
  importarRcvAction,
  type ResultadoImportacionSii,
  type ResultadoRcvCrudo,
} from "@/lib/actions/sii";
import type { DocRcv } from "@/lib/sii/tipos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Detalle = { folio: string; rut: string; resultado: string };

const ETIQUETA: Record<"compra" | "venta", string> = {
  compra: "Compras",
  venta: "Ventas",
};

export function ImportarRcv({
  empresaId,
  origen,
}: {
  empresaId: string;
  origen: "compra" | "venta";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPendingCrudo, startTransitionCrudo] = useTransition();
  const now = new Date();
  const [periodo, setPeriodo] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [res, setRes] = useState<ResultadoImportacionSii | null>(null);
  const [crudo, setCrudo] = useState<ResultadoRcvCrudo | null>(null);
  const [detalle, setDetalle] = useState<DocRcv | null>(null);

  function importar() {
    setRes(null);
    startTransition(async () => {
      const r = await importarRcvAction(empresaId, periodo, origen);
      setRes(r);
      if (r.ok) {
        toast.success(`${ETIQUETA[origen]}: ${r.creados} nuevos`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function verCrudo() {
    setCrudo(null);
    startTransitionCrudo(async () => {
      const r = await descargarRcvCrudoAction(empresaId, periodo, origen);
      setCrudo(r);
      if (r.ok) toast.success(`SII conectó: ${r.docs.length} documentos recibidos`);
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor={`rcv-periodo-${origen}`}>Período tributario</Label>
          <Input
            id={`rcv-periodo-${origen}`}
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-48"
          />
        </div>
        <Button onClick={importar} disabled={isPending}>
          {isPending ? "Importando…" : `Importar ${ETIQUETA[origen]} del SII`}
        </Button>
        <Button variant="outline" onClick={verCrudo} disabled={isPendingCrudo}>
          {isPendingCrudo ? "Descargando…" : "Ver datos crudos (sin importar)"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Descarga el Registro de {ETIQUETA[origen]} del SII para el período y crea los
        documentos en <strong>borrador</strong>. Los ya existentes (mismo folio y
        contraparte) se omiten. &quot;Ver datos crudos&quot; solo consulta el SII y
        muestra lo que trae, sin crear ni validar nada en el sistema — útil para
        confirmar que la conexión funciona.
      </p>

      {crudo && (
        <div className="space-y-2">
          {crudo.ok ? (
            crudo.docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                El SII conectó pero no devolvió documentos para este período.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Folio</TableHead>
                      <TableHead>RUT</TableHead>
                      <TableHead>Razón social</TableHead>
                      <TableHead>Tipo DTE</TableHead>
                      <TableHead>Emisión</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado RCV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crudo.docs.map((d, i) => (
                      <TableRow
                        key={i}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setDetalle(d)}
                      >
                        <TableCell className="font-mono">{d.folio}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {d.rutContraparte}
                        </TableCell>
                        <TableCell>{d.nombreContraparte ?? "—"}</TableCell>
                        <TableCell>{d.tipoDte}</TableCell>
                        <TableCell>{d.fechaEmision}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.montoNeto.toLocaleString("es-CL")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.montoIva.toLocaleString("es-CL")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.montoTotal.toLocaleString("es-CL")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.estadoRcv ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <p className="text-sm text-destructive">{crudo.error}</p>
          )}
          {crudo.ok && crudo.docs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Haz clic en una fila para ver el detalle crudo que entregó el SII.
            </p>
          )}
        </div>
      )}

      {res?.ok && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {res.creados} creados · {res.existentes} ya existían · {res.errores} con error
          </p>
          {res.detalle.length > 0 && (
            <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Folio</TableHead>
                    <TableHead>RUT</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(res.detalle as Detalle[]).map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{d.folio}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{d.rut}</TableCell>
                      <TableCell
                        className={
                          d.resultado.startsWith("creado") ? "" : "text-muted-foreground"
                        }
                      >
                        {d.resultado}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!detalle} onOpenChange={(open) => !open && setDetalle(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Folio {detalle?.folio} — {detalle?.nombreContraparte ?? detalle?.rutContraparte}
            </DialogTitle>
          </DialogHeader>
          {detalle?.crudo ? (
            <div className="max-h-[60vh] overflow-y-auto rounded-lg ring-1 ring-foreground/10">
              <Table>
                <TableBody>
                  {Object.entries(detalle.crudo)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([campo, valor]) => (
                      <TableRow key={campo}>
                        <TableCell className="w-56 font-mono text-xs text-muted-foreground">
                          {campo}
                        </TableCell>
                        <TableCell className="font-mono text-xs break-all">
                          {valor === null || valor === undefined
                            ? "∅"
                            : typeof valor === "object"
                              ? JSON.stringify(valor)
                              : String(valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin detalle crudo disponible para este documento.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
