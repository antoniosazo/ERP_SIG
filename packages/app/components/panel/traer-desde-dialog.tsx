"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";
import type { DocumentoCompraTipo } from "@erp/shared";
import { traerDesdeDocumentoAction } from "@/lib/actions/compras";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Linea = {
  id: string;
  numeroLinea: number;
  glosa: string | null;
  cantidadPendiente: number;
  precioUnitario: number;
};

/** Selecciona líneas pendientes de un documento base y crea el documento aguas abajo. */
export function TraerDesdeDialog({
  empresaId,
  documentoBaseId,
  lineas,
  docTipoDestino,
  boton,
  titulo,
}: {
  empresaId: string;
  documentoBaseId: string;
  lineas: Linea[];
  docTipoDestino: DocumentoCompraTipo;
  boton: string;
  titulo: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [sel, setSel] = useState<Record<string, { on: boolean; cantidad: number }>>(() =>
    Object.fromEntries(
      lineas.map((l) => [l.id, { on: true, cantidad: l.cantidadPendiente }]),
    ),
  );

  function traer() {
    const elegidas = lineas
      .filter((l) => sel[l.id]?.on && (sel[l.id]?.cantidad ?? 0) > 0)
      .map((l) => ({ lineaBaseId: l.id, cantidad: sel[l.id]!.cantidad }));
    if (elegidas.length === 0) {
      toast.error("Selecciona al menos una línea con cantidad.");
      return;
    }
    startTransition(async () => {
      const r = await traerDesdeDocumentoAction(empresaId, {
        documentoBaseId,
        docTipoDestino,
        lineas: elegidas,
      });
      if (r.ok) {
        setAbierto(false);
        router.push(`/panel/${empresaId}/compras/documentos/${r.docId}`);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setAbierto(true)}
      >
        <ArrowRightIcon className="mr-1 size-4" />
        {boton}
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Línea</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Cantidad a traer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={sel[l.id]?.on ?? false}
                        onChange={(e) =>
                          setSel((s) => ({
                            ...s,
                            [l.id]: { ...s[l.id]!, on: e.target.checked },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      #{l.numeroLinea + 1} {l.glosa ?? ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.cantidadPendiente.toLocaleString("es-CL", { maximumFractionDigits: 4 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.000001"
                        max={l.cantidadPendiente}
                        className="ml-auto w-28 text-right"
                        value={sel[l.id]?.cantidad ?? 0}
                        onChange={(e) =>
                          setSel((s) => ({
                            ...s,
                            [l.id]: { ...s[l.id]!, cantidad: Number(e.target.value) },
                          }))
                        }
                        disabled={!sel[l.id]?.on}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={traer} disabled={isPending}>
              {isPending ? "Creando..." : boton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
