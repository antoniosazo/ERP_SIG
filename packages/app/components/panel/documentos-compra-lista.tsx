"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DocumentoCompraTipo } from "@erp/shared";
import {
  descartarDocumentoCompraPendienteAction,
  reintentarFacturaCompraPendienteAction,
} from "@/lib/actions/compras";
import { COMPRA_TIPO_META } from "@/lib/compras";
import { etiquetaEstado } from "@/lib/documentos-ux";
import { TerceroEnlace } from "@/components/panel/tercero-enlace";
import { SelectorBuscable } from "@/components/panel/selector-buscable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilaGrupo, useAgrupado, useExpandidos } from "./tabla-agrupada";

export type DocCompraFila = {
  id: string;
  numeroInterno: string | null;
  docTipo: DocumentoCompraTipo;
  tipoDocumento: string;
  folio: string | null;
  proveedor: string;
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
  if (estado === "contabilizado" || estado === "cerrado") return "secondary";
  if (estado === "anulado") return "destructive";
  return "default";
}

export function DocumentosCompraLista({
  empresaId,
  docTipo,
  documentos,
  filtros,
  pagina,
  paginas,
  total,
  proveedores,
  proveedoresFiltro,
  puedeEditar,
  hoy,
}: {
  empresaId: string;
  docTipo: DocumentoCompraTipo;
  documentos: DocCompraFila[];
  filtros: Filtros;
  pagina: number;
  paginas: number;
  total: number;
  proveedores: Opcion[];
  proveedoresFiltro: Opcion[];
  puedeEditar: boolean;
  hoy: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(filtros.q);
  const [desde, setDesde] = useState(filtros.desde);
  const [hasta, setHasta] = useState(filtros.hasta);
  const [proveedorFiltro, setProveedorFiltro] = useState(filtros.terceroId);
  const [descartarId, setDescartarId] = useState<string | null>(null);
  const meta = COMPRA_TIPO_META[docTipo];
  const esOC = docTipo === "pedido";
  const porEstado = useAgrupado(documentos, (d) => d.estado);
  const { expandidos, alternar } = useExpandidos(["borrador", "abierto", "contabilizado"]);
  const detalleHref = (id: string) => `/panel/${empresaId}/compras/documentos/${id}`;

  function navegar(cambios: Partial<Filtros> & { pagina?: string }) {
    const params = new URLSearchParams();
    const valores = { ...filtros, q, desde, hasta, terceroId: proveedorFiltro, ...cambios };
    if (valores.desde && valores.hasta && valores.desde > valores.hasta) {
      toast.error("La fecha Desde no puede ser posterior a Hasta.");
      return;
    }
    for (const [k, v] of Object.entries(valores)) if (v) params.set(k, v);
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ""}`);
  }

  function reintentar(docId: string) {
    startTransition(async () => {
      const r = await reintentarFacturaCompraPendienteAction(empresaId, docId);
      if (r.ok) {
        toast.success("Documento contabilizado.");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function descartar() {
    if (!descartarId) return;
    const r = await descartarDocumentoCompraPendienteAction(empresaId, descartarId);
    if (r.ok) {
      toast.success("Borrador descartado.");
      setDescartarId(null);
      router.refresh();
    } else toast.error(r.error);
  }

  const grupos = ["borrador", "abierto", "contabilizado", "cerrado", "anulado"].filter((e) => porEstado.has(e));
  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-xl border p-3 md:grid-cols-2 xl:grid-cols-6" onSubmit={(e) => { e.preventDefault(); navegar({ pagina: "1" }); }}>
        <div className="space-y-1 xl:col-span-2">
          <Label htmlFor="buscar-compra">{esOC ? "Número o proveedor" : "Folio, número o proveedor"}</Label>
          <Input id="buscar-compra" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" />
        </div>
        <div className="space-y-1"><Label htmlFor="compra-desde">Desde</Label><Input id="compra-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="compra-hasta">Hasta</Label><Input id="compra-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div className="space-y-1 xl:col-span-2">
          <Label>Proveedor</Label>
          <SelectorBuscable value={proveedorFiltro} onValueChange={(v) => setProveedorFiltro(v ?? "")} opciones={proveedoresFiltro} placeholder="Todos los proveedores" />
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-6">
          <Select value={filtros.estado || TODOS} onValueChange={(v) => navegar({ estado: v === TODOS ? "" : v, pagina: "1" })}>
            <SelectTrigger className="w-44" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              {docTipo === "pedido" && <SelectItem value="abierto">Abierto</SelectItem>}
              {docTipo !== "pedido" && <SelectItem value="contabilizado">Contabilizado</SelectItem>}
              {(docTipo === "pedido" || docTipo === "entrada_mercaderia") && <SelectItem value="cerrado">Cerrado</SelectItem>}
              <SelectItem value="anulado">Anulado</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="bg-amber-400 text-amber-950 hover:bg-amber-500">Aplicar filtros</Button>
          <Button type="button" variant="outline" onClick={() => { setQ(""); setDesde(""); setHasta(""); setProveedorFiltro(""); router.push(pathname); }}>Limpiar</Button>
          <span className="text-sm text-muted-foreground">{total} registro(s)</span>
          {puedeEditar && (proveedores.length
            ? <Button asChild className="ml-auto"><Link href={`/panel/${empresaId}/compras/documentos/nuevo?docTipo=${docTipo}`}>Nuevo {meta.singular}</Link></Button>
            : <Button type="button" className="ml-auto" disabled>Nuevo {meta.singular}</Button>)}
        </div>
      </form>

      {!puedeEditar && <p className="text-xs text-muted-foreground">Acceso de consulta a documentos de compra.</p>}
      {puedeEditar && proveedores.length === 0 && <p className="text-sm text-destructive">Crea o activa un proveedor antes de registrar el documento.</p>}
      {documentos.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hay documentos que coincidan con los filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader><TableRow><TableHead>N° interno</TableHead>{!esOC && <TableHead>Tipo / folio</TableHead>}<TableHead>Proveedor</TableHead><TableHead>Emisión</TableHead><TableHead>Vencimiento</TableHead><TableHead>Moneda</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Saldo</TableHead>{puedeEditar && <TableHead className="text-right">Acciones</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {grupos.map((estado) => {
                const items = porEstado.get(estado) ?? [];
                const abiertoGrupo = expandidos.has(estado);
                return <Fragment key={estado}>
                  <FilaGrupo abierto={abiertoGrupo} onToggle={() => alternar(estado)} colSpan={(puedeEditar ? 9 : 8) - (esOC ? 1 : 0)}><Badge variant={badge(estado)}>{etiquetaEstado(estado)}</Badge><span className="text-muted-foreground">({items.length})</span></FilaGrupo>
                  {abiertoGrupo && items.map((d) => {
                    const vencida = d.estado === "contabilizado" && d.saldo > 0.01 && !!d.fechaVencimiento && d.fechaVencimiento < hoy;
                    return <TableRow key={d.id} className="cursor-pointer" role="link" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(detalleHref(d.id)); } }}
                      onClick={(e) => { if ((e.target as HTMLElement).closest("a,button")) return; router.push(detalleHref(d.id)); }}>
                      <TableCell className="font-mono font-medium"><Link href={detalleHref(d.id)} className="hover:underline">{d.numeroInterno ?? "—"}</Link></TableCell>
                      {!esOC && <TableCell><div>{d.tipoDocumento}</div><div className="font-mono text-xs text-muted-foreground">Folio {d.folio ?? "—"}</div></TableCell>}
                      <TableCell><TerceroEnlace empresaId={empresaId} terceroId={d.terceroId}>{d.proveedor}</TerceroEnlace></TableCell>
                      <TableCell>{d.fechaEmision}</TableCell>
                      <TableCell><span className={vencida ? "font-medium text-destructive" : "text-muted-foreground"}>{d.fechaVencimiento ?? "—"}</span>{vencida && <Badge variant="destructive" className="ml-2">Vencida</Badge>}</TableCell>
                      <TableCell>{d.moneda}</TableCell><TableCell className="text-right tabular-nums">{Number(d.montoTotal).toLocaleString("es-CL")}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.estado === "contabilizado" && d.docTipo !== "nota_credito" ? d.saldo.toLocaleString("es-CL") : "—"}</TableCell>
                      {puedeEditar && <TableCell className="text-right"><div className="flex justify-end gap-1">
                        {d.estado === "borrador" && (d.puedeReintentar ? <Button type="button" size="xs" variant="secondary" disabled={isPending} onClick={() => reintentar(d.id)}>Reintentar</Button> : <Button asChild size="xs" variant="secondary"><Link href={detalleHref(d.id)}>Completar</Link></Button>)}
                        {d.estado === "borrador" && <Button type="button" size="xs" variant="destructive" onClick={() => setDescartarId(d.id)}>Descartar</Button>}
                        {d.docTipo === "factura" && d.estado === "contabilizado" && d.saldo > 0.005 && <Button asChild size="xs" variant="outline"><Link href={`/panel/${empresaId}/tesoreria/pagos-efectuados/nuevo?terceroId=${d.terceroId}&documentoId=${d.id}`}>Pagar</Link></Button>}
                      </div></TableCell>}
                    </TableRow>;
                  })}
                </Fragment>;
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {paginas > 1 && <div className="flex items-center justify-end gap-2"><Button type="button" variant="outline" disabled={pagina <= 1} onClick={() => navegar({ pagina: String(pagina - 1) })}>Anterior</Button><span className="text-sm text-muted-foreground">Página {pagina} de {paginas}</span><Button type="button" variant="outline" disabled={pagina >= paginas} onClick={() => navegar({ pagina: String(pagina + 1) })}>Siguiente</Button></div>}

      <ConfirmDialog open={descartarId !== null} onOpenChange={(open) => !open && setDescartarId(null)} title={`Descartar ${meta.singular} en borrador`} description={`El documento quedará anulado en el historial y no podrá contabilizarse.`} confirmLabel="Descartar" onConfirm={descartar} />
    </div>
  );
}
