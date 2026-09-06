"use client";

import { useState, useTransition } from "react";
import { BookOpenIcon } from "lucide-react";
import { toast } from "sonner";
import { verAsientoVentaAction, type AsientoVistaDTO } from "@/lib/actions/ventas";

type VerAsientoFn = (
  empresaId: string,
  docId: string,
) => Promise<{ ok: true; data: AsientoVistaDTO } | { ok: false; error: string }>;
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

const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 4 });

/** Muestra el asiento real del documento (si está contabilizado) o su vista previa. */
export function AsientoDialog({
  empresaId,
  docId,
  verAsiento = verAsientoVentaAction,
}: {
  empresaId: string;
  docId: string;
  verAsiento?: VerAsientoFn;
}) {
  const [abierto, setAbierto] = useState(false);
  const [data, setData] = useState<AsientoVistaDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrir() {
    setAbierto(true);
    setData(null);
    startTransition(async () => {
      const r = await verAsiento(empresaId, docId);
      if (r.ok) setData(r.data);
      else {
        toast.error(r.error);
        setAbierto(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={abrir}
        title="Ver asiento"
        aria-label="Ver asiento"
      >
        <BookOpenIcon />
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {data?.modo === "real"
                ? `Asiento N° ${data.correlativo}`
                : "Vista previa del asiento"}
            </DialogTitle>
          </DialogHeader>

          {isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}

          {data && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {data.fecha} · {data.glosa}
              </div>

              {data.errores.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {data.errores.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              )}

              <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta / SN</TableHead>
                      <TableHead>Centro de costo</TableHead>
                      <TableHead>Glosa</TableHead>
                      <TableHead className="text-right">Debe</TableHead>
                      <TableHead className="text-right">Haber</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lineas.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{l.cuenta}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {l.centroCosto ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{l.glosa ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.debe ? num(l.debe) : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.haber ? num(l.haber) : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-medium">
                      <TableCell colSpan={3} className="text-right">
                        Totales
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{num(data.totalDebe)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(data.totalHaber)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {!data.cuadra && (
                <p className="text-sm text-destructive">El asiento no cuadra.</p>
              )}
              {data.modo === "previa" && data.errores.length === 0 && data.cuadra && (
                <p className="text-sm text-muted-foreground">
                  Vista previa: al contabilizar se generará este asiento.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
