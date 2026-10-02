"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";
import type { DocumentoCompraTipo } from "@erp/shared";
import { traerDesdeDocumentoAction } from "@/lib/actions/compras";
import { SelectorBuscable } from "@/components/panel/selector-buscable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { cn } from "@/lib/utils";

type Linea = {
  id: string;
  numeroLinea: number;
  glosa: string | null;
  cantidadPendiente: number;
  precioUnitario: number;
};

export type DestinoTraer = {
  docTipoDestino: DocumentoCompraTipo;
  /** Nombre del documento que se creará, p. ej. "Entrada de mercadería". */
  etiqueta: string;
  /** Por qué se ofrece, p. ej. "2 líneas de inventario". */
  detalle: string;
  lineas: Linea[];
  /** Tipos SII entre los que elegir cuando el destino es una factura. */
  tiposDocumento?: { id: string; label: string }[];
};

/** Selecciona líneas pendientes de un documento base y crea el documento aguas abajo (uno o varios destinos posibles). */
export function TraerDesdeDialog({
  empresaId,
  documentoBaseId,
  destinos,
  boton,
  titulo,
}: {
  empresaId: string;
  documentoBaseId: string;
  destinos: DestinoTraer[];
  boton: string;
  titulo: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [indice, setIndice] = useState(0);
  const destino = destinos[Math.min(indice, destinos.length - 1)]!;
  const pideTipo = destino.docTipoDestino === "factura";
  const [tipoDocumentoId, setTipoDocumentoId] = useState("");
  const [sel, setSel] = useState<Record<string, { on: boolean; cantidad: number }>>(() =>
    Object.fromEntries(
      destinos.flatMap((d) => d.lineas).map((l) => [l.id, { on: true, cantidad: l.cantidadPendiente }]),
    ),
  );

  function traer() {
    const elegidas = destino.lineas
      .filter((l) => sel[l.id]?.on && (sel[l.id]?.cantidad ?? 0) > 0)
      .map((l) => ({ lineaBaseId: l.id, cantidad: sel[l.id]!.cantidad }));
    if (elegidas.length === 0) {
      toast.error("Selecciona al menos una línea con cantidad.");
      return;
    }
    if (pideTipo && !tipoDocumentoId) {
      toast.error("Selecciona el tipo de documento de la factura.");
      return;
    }
    startTransition(async () => {
      const r = await traerDesdeDocumentoAction(empresaId, {
        documentoBaseId,
        docTipoDestino: destino.docTipoDestino,
        tipoDocumentoId: pideTipo ? tipoDocumentoId : null,
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
            {destinos.length > 1 && (
              <DialogDescription>
                Esta orden tiene líneas para distintos documentos. Elige cuál crear ahora; el otro podrás crearlo después.
              </DialogDescription>
            )}
          </DialogHeader>
          {destinos.length > 1 && (
            <div role="radiogroup" aria-label="Documento a crear" className="grid gap-2 sm:grid-cols-2">
              {destinos.map((d, i) => (
                <button
                  key={d.docTipoDestino}
                  type="button"
                  role="radio"
                  aria-checked={i === indice}
                  onClick={() => setIndice(i)}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition",
                    i === indice ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted",
                  )}
                >
                  <div className="font-medium">{d.etiqueta}</div>
                  <div className="text-xs text-muted-foreground">{d.detalle}</div>
                </button>
              ))}
            </div>
          )}
          {pideTipo && (
            <div className="space-y-2">
              <Label>Tipo de documento (SII)</Label>
              <SelectorBuscable
                value={tipoDocumentoId}
                onValueChange={(v) => setTipoDocumentoId(v ?? "")}
                opciones={destino.tiposDocumento ?? []}
                placeholder="Selecciona el tipo"
              />
            </div>
          )}
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
                {destino.lineas.map((l) => (
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
              {isPending ? "Creando..." : `Crear ${destino.etiqueta.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
