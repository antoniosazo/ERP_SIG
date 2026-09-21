"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DocumentoVentaClase } from "@erp/shared";
import { crearDocumentoVentaAction } from "@/lib/actions/ventas";
import { VENTA_CLASE_META } from "@/lib/ventas";
import { TerceroEnlace } from "@/components/panel/tercero-enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { FilaGrupo, useAgrupado, useExpandidos } from "./tabla-agrupada";

export type DocFila = {
  id: string;
  numeroInterno: string | null;
  clase: string;
  tipoDocumento: string;
  folio: string | null;
  cliente: string;
  terceroId: string;
  fechaEmision: string;
  montoTotal: string;
  estado: string;
};
type Opcion = { id: string; label: string };
const TODOS = "__all__";

function badge(estado: string): "default" | "secondary" | "destructive" {
  if (estado === "contabilizado") return "secondary";
  if (estado === "anulado") return "destructive";
  return "default";
}

export function DocumentosVentaLista({
  empresaId,
  clase,
  documentos,
  filtroEstado,
  tiposDocumento,
  clientes,
}: {
  empresaId: string;
  clase: DocumentoVentaClase;
  documentos: DocFila[];
  filtroEstado: string;
  tiposDocumento: Opcion[];
  clientes: Opcion[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [tipoDocumentoId, setTipoDocumentoId] = useState(tiposDocumento[0]?.id ?? "");
  const [terceroId, setTerceroId] = useState(clientes[0]?.id ?? "");
  const singular = VENTA_CLASE_META[clase].singular;
  const porEstado = useAgrupado(documentos, (d) => d.estado);
  const { expandidos: estadosAbiertos, alternar: alternarEstado } = useExpandidos();

  function filtrar(estado: string) {
    router.push(estado === TODOS ? pathname : `${pathname}?estado=${estado}`);
  }

  function crear() {
    if (!tipoDocumentoId || !terceroId) {
      toast.error("Elige tipo de documento y cliente.");
      return;
    }
    startTransition(async () => {
      const r = await crearDocumentoVentaAction(empresaId, { clase, tipoDocumentoId, terceroId });
      if (r.ok) {
        setAbierto(false);
        router.push(`/panel/${empresaId}/ventas/documentos/${r.docId}`);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={filtroEstado || TODOS} onValueChange={filtrar}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los estados</SelectItem>
            {clase !== "Factura" && <SelectItem value="borrador">Borrador</SelectItem>}
            <SelectItem value="contabilizado">Contabilizado</SelectItem>
            <SelectItem value="anulado">Anulado</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setAbierto(true)} disabled={clientes.length === 0}>
          Nueva {singular}
        </Button>
      </div>

      {documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin registros.</p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">N° interno</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...porEstado.entries()].map(([estado, items]) => {
                const abierto = estadosAbiertos.has(estado);
                return (
                  <Fragment key={estado}>
                    <FilaGrupo abierto={abierto} onToggle={() => alternarEstado(estado)} colSpan={6}>
                      <Badge variant={badge(estado)}>{estado}</Badge>
                      <span className="text-muted-foreground">({items.length})</span>
                    </FilaGrupo>
                    {abierto &&
                      items.map((d) => (
                        <TableRow
                          key={d.id}
                          className="cursor-pointer"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("a")) return;
                            router.push(`/panel/${empresaId}/ventas/documentos/${d.id}`);
                          }}
                        >
                          <TableCell className="font-mono font-medium">
                            <Link
                              href={`/panel/${empresaId}/ventas/documentos/${d.id}`}
                              className="hover:underline"
                            >
                              {d.numeroInterno ?? "—"}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{d.tipoDocumento}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {d.folio ?? "—"}
                          </TableCell>
                          <TableCell>
                            <TerceroEnlace empresaId={empresaId} terceroId={d.terceroId}>
                              {d.cliente}
                            </TerceroEnlace>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {d.fechaEmision}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Number(d.montoTotal).toLocaleString("es-CL")}
                          </TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva {singular}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de documento (SII)</Label>
              <Select value={tipoDocumentoId} onValueChange={setTipoDocumentoId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposDocumento.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={terceroId} onValueChange={setTerceroId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
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
            <Button onClick={crear} disabled={isPending}>
              {isPending ? "Creando..." : "Crear y abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
