"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DocumentoVentaClase } from "@erp/shared";
import {
  descartarFacturaPendienteAction,
  reintentarFacturaPendienteAction,
} from "@/lib/actions/ventas";
import { VENTA_CLASE_META } from "@/lib/ventas";
import { etiquetaEstado } from "@/lib/documentos-ux";
import { TerceroEnlace } from "@/components/panel/tercero-enlace";
import { SelectorBuscable } from "@/components/panel/selector-buscable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
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
  fechaVencimiento: string | null;
  montoTotal: string;
  saldo: number;
  moneda: string;
  estado: string;
  puedeReintentar: boolean;
};
type Opcion = { id: string; label: string };
type Filtros = { estado: string; q: string; desde: string; hasta: string; terceroId: string };
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
  filtros,
  pagina,
  paginas,
  total,
  clientes,
  clientesFiltro,
  puedeEditar,
  hoy,
}: {
  empresaId: string;
  clase: DocumentoVentaClase;
  documentos: DocFila[];
  filtros: Filtros;
  pagina: number;
  paginas: number;
  total: number;
  clientes: Opcion[];
  clientesFiltro: Opcion[];
  puedeEditar: boolean;
  hoy: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(filtros.q);
  const [desde, setDesde] = useState(filtros.desde);
  const [hasta, setHasta] = useState(filtros.hasta);
  const [clienteFiltro, setClienteFiltro] = useState(filtros.terceroId);
  const [descartarId, setDescartarId] = useState<string | null>(null);
  const singular = VENTA_CLASE_META[clase].singular;
  const porEstado = useAgrupado(documentos, (d) => d.estado);
  const { expandidos: estadosAbiertos, alternar: alternarEstado } = useExpandidos([
    "borrador",
    "contabilizado",
  ]);

  function navegar(cambios: Partial<Filtros> & { pagina?: string }) {
    const actual = new URLSearchParams();
    const valores = { ...filtros, q, desde, hasta, terceroId: clienteFiltro, ...cambios };
    if (valores.desde && valores.hasta && valores.desde > valores.hasta) {
      toast.error("La fecha Desde no puede ser posterior a Hasta.");
      return;
    }
    for (const [k, v] of Object.entries(valores)) {
      if (v) actual.set(k, v);
    }
    router.push(`${pathname}${actual.size ? `?${actual.toString()}` : ""}`);
  }

  function reintentar(docId: string) {
    startTransition(async () => {
      const r = await reintentarFacturaPendienteAction(empresaId, docId);
      if (r.ok) {
        toast.success("Factura contabilizada.");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function descartar() {
    if (!descartarId) return;
    const r = await descartarFacturaPendienteAction(empresaId, descartarId);
    if (r.ok) {
      toast.success("Borrador descartado.");
      setDescartarId(null);
      router.refresh();
    } else toast.error(r.error);
  }

  const gruposOrdenados = ["borrador", "contabilizado", "anulado"].filter((e) => porEstado.has(e));
  const detalleHref = (id: string) => `/panel/${empresaId}/ventas/documentos/${id}`;

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-xl border p-3 md:grid-cols-2 xl:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          navegar({ pagina: "1" });
        }}
      >
        <div className="space-y-1 xl:col-span-2">
          <Label htmlFor="buscar-documento">Folio, número o cliente</Label>
          <Input
            id="buscar-documento"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="space-y-1 xl:col-span-2">
          <Label>Cliente</Label>
          <SelectorBuscable
            value={clienteFiltro}
            onValueChange={(v) => setClienteFiltro(v ?? "")}
            opciones={clientesFiltro}
            placeholder="Todos los clientes"
            permitirVacio
            etiquetaVacia="Todos los clientes"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6">
          <Select
            value={filtros.estado || TODOS}
            onValueChange={(estado) => navegar({ estado: estado === TODOS ? "" : estado, pagina: "1" })}
          >
            <SelectTrigger className="w-44" aria-label="Filtrar por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="contabilizado">Contabilizado</SelectItem>
              <SelectItem value="anulado">Anulado</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="bg-amber-400 text-amber-950 hover:bg-amber-500">Aplicar filtros</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setQ("");
              setDesde("");
              setHasta("");
              setClienteFiltro("");
              router.push(pathname);
            }}
          >
            Limpiar
          </Button>
          <span className="text-sm text-muted-foreground">{total} registro(s)</span>
          {puedeEditar && (clientes.length > 0 ? (
            <Button asChild className="ml-auto">
              <Link href={`/panel/${empresaId}/ventas/documentos/nuevo?clase=${encodeURIComponent(clase)}`}>Nueva {singular}</Link>
            </Button>
          ) : (
            <Button type="button" className="ml-auto" disabled>Nueva {singular}</Button>
          ))}
        </div>
      </form>

      {!puedeEditar && (
        <p className="text-xs text-muted-foreground">Acceso de consulta a documentos de venta.</p>
      )}
      {puedeEditar && clientes.length === 0 && (
        <p className="text-sm text-destructive">Crea o activa un cliente antes de registrar una factura.</p>
      )}

      {documentos.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay documentos que coincidan con los filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">N° interno</TableHead>
                <TableHead>Tipo / folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                {puedeEditar && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {gruposOrdenados.map((estado) => {
                const items = porEstado.get(estado) ?? [];
                const grupoAbierto = estadosAbiertos.has(estado);
                return (
                  <Fragment key={estado}>
                    <FilaGrupo
                      abierto={grupoAbierto}
                      onToggle={() => alternarEstado(estado)}
                      colSpan={puedeEditar ? 9 : 8}
                    >
                      <Badge variant={badge(estado)}>{etiquetaEstado(estado)}</Badge>
                      <span className="text-muted-foreground">({items.length})</span>
                    </FilaGrupo>
                    {grupoAbierto && items.map((d) => {
                      const vencida =
                        d.estado === "contabilizado" && d.saldo > 0.01 && !!d.fechaVencimiento && d.fechaVencimiento < hoy;
                      return (
                        <TableRow
                          key={d.id}
                          className="cursor-pointer"
                          role="link"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(detalleHref(d.id));
                            }
                          }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("a,button")) return;
                            router.push(detalleHref(d.id));
                          }}
                        >
                          <TableCell className="font-mono font-medium">
                            <Link href={detalleHref(d.id)} className="hover:underline">
                              {d.numeroInterno ?? "—"}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div>{d.tipoDocumento}</div>
                            <div className="font-mono text-xs text-muted-foreground">Folio {d.folio ?? "—"}</div>
                          </TableCell>
                          <TableCell>
                            <TerceroEnlace empresaId={empresaId} terceroId={d.terceroId}>{d.cliente}</TerceroEnlace>
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">{d.fechaEmision}</TableCell>
                          <TableCell className="tabular-nums">
                            <span className={vencida ? "font-medium text-destructive" : "text-muted-foreground"}>
                              {d.fechaVencimiento ?? "—"}
                            </span>
                            {vencida && <Badge variant="destructive" className="ml-2">Vencida</Badge>}
                          </TableCell>
                          <TableCell>{d.moneda}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Number(d.montoTotal).toLocaleString("es-CL")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.estado === "contabilizado" && d.clase !== "Nota de Crédito"
                              ? d.saldo.toLocaleString("es-CL")
                              : "—"}
                          </TableCell>
                          {puedeEditar && (
                            <TableCell className="text-right">
                              {d.estado === "borrador" && (
                                <div className="flex justify-end gap-1">
                                  {d.puedeReintentar ? (
                                    <Button type="button" size="xs" variant="secondary" disabled={isPending} onClick={() => reintentar(d.id)}>
                                      Reintentar
                                    </Button>
                                  ) : (
                                    <Button asChild type="button" size="xs" variant="secondary">
                                      <Link href={detalleHref(d.id)}>Completar</Link>
                                    </Button>
                                  )}
                                  <Button type="button" size="xs" variant="destructive" onClick={() => setDescartarId(d.id)}>
                                    Descartar
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {paginas > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" disabled={pagina <= 1} onClick={() => navegar({ pagina: String(pagina - 1) })}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {pagina} de {paginas}</span>
          <Button type="button" variant="outline" disabled={pagina >= paginas} onClick={() => navegar({ pagina: String(pagina + 1) })}>
            Siguiente
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={descartarId !== null}
        onOpenChange={(open) => !open && setDescartarId(null)}
        title={`Descartar ${singular} en borrador`}
        description={`La ${singular} quedará anulada en el historial y no podrá contabilizarse.`}
        confirmLabel="Descartar"
        onConfirm={descartar}
      />
    </div>
  );
}
