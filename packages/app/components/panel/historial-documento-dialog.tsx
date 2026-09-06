"use client";

import { Fragment, useState, useTransition } from "react";
import { HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import { historialDocumentoVentaAction, type HistorialFila } from "@/lib/actions/ventas";

type HistorialFn = (
  empresaId: string,
  docId: string,
) => Promise<{ ok: true; filas: HistorialFila[] } | { ok: false; error: string }>;
import { Badge } from "@/components/ui/badge";
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

const ACCION_LABEL: Record<string, string> = {
  crear: "Creación",
  editar: "Edición",
  eliminar: "Eliminación",
  cambio_estado: "Cambio de estado",
};
const OCULTAR = new Set([
  "id",
  "empresaId",
  "creadoEn",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
]);

function mostrarValor(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function diffCampos(f: HistorialFila) {
  const antes = f.valoresAnteriores ?? {};
  const despues = f.valoresNuevos ?? {};
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter(
    (k) => !OCULTAR.has(k),
  );
  const salida: { campo: string; antes: string; despues: string }[] = [];
  for (const k of claves.sort()) {
    const a = mostrarValor((antes as Record<string, unknown>)[k]);
    const d = mostrarValor((despues as Record<string, unknown>)[k]);
    if (f.accion === "editar" && a === d) continue;
    salida.push({ campo: k, antes: a, despues: d });
  }
  return salida;
}

/** Bitácora de modificaciones de este documento (icono de historial en la barra). */
export function HistorialDocumentoDialog({
  empresaId,
  docId,
  historial = historialDocumentoVentaAction,
}: {
  empresaId: string;
  docId: string;
  historial?: HistorialFn;
}) {
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<HistorialFila[] | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrir() {
    setAbierto(true);
    setFilas(null);
    setExpandida(null);
    startTransition(async () => {
      const r = await historial(empresaId, docId);
      if (r.ok) setFilas(r.filas);
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
        title="Historial de modificaciones"
        aria-label="Historial de modificaciones"
      >
        <HistoryIcon />
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historial de modificaciones</DialogTitle>
          </DialogHeader>

          {isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}

          {filas && filas.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
          )}

          {filas && filas.length > 0 && (
            <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead className="text-right">Cambios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((f) => {
                    const abiertaFila = expandida === f.id;
                    const cambios = diffCampos(f);
                    return (
                      <Fragment key={f.id}>
                        <TableRow>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {new Date(f.creadoEn).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell>{f.usuarioNombre}</TableCell>
                          <TableCell>
                            <Badge variant={f.accion === "eliminar" ? "destructive" : "secondary"}>
                              {ACCION_LABEL[f.accion] ?? f.accion}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandida(abiertaFila ? null : f.id)}
                            >
                              {abiertaFila ? "Ocultar" : "Ver cambios"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {abiertaFila && (
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/30">
                              {f.motivo && (
                                <p className="mb-2 text-sm">
                                  <span className="text-muted-foreground">Motivo:</span> {f.motivo}
                                </p>
                              )}
                              {cambios.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Sin campos con cambios.
                                </p>
                              ) : (
                                <ul className="space-y-1 text-sm">
                                  {cambios.map((c) => (
                                    <li key={c.campo} className="flex flex-wrap gap-x-2">
                                      <span className="font-mono text-muted-foreground">
                                        {c.campo}:
                                      </span>
                                      {f.accion !== "crear" && (
                                        <span className="text-destructive/80 line-through">
                                          {c.antes}
                                        </span>
                                      )}
                                      {f.accion !== "eliminar" && (
                                        <>
                                          <span className="text-muted-foreground">→</span>
                                          <span>{c.despues}</span>
                                        </>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
