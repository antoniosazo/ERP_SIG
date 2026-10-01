"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { WorkflowIcon } from "lucide-react";
import { toast } from "sonner";
import { formatearRut } from "@erp/shared";
import { mapaRelacionesAction } from "@/lib/actions/mapa-relaciones";
import {
  disponerGrafo,
  ETIQUETA_RELACION,
  TARJETA,
  type MapaRelacionesDTO,
  type NodoMapaDTO,
  type Posicion,
} from "@/lib/mapa-grafo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const pesos = (v: string) =>
  Number(v).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const ALTO_SOCIO = 76;
const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "Borrador",
  abierto: "Abierto",
  contabilizado: "Contabilizado",
  cerrado: "Cerrado",
  anulado: "Anulado",
  en_cartera: "En cartera",
  depositado: "Depositado",
  protestado: "Protestado",
  emitido: "Emitido",
  cobrado: "Cobrado",
};

function Tarjeta({ nodo, pos }: { nodo: NodoMapaDTO; pos: Posicion }) {
  const enlace = nodo.href && !nodo.raiz;
  const contenido = (
    <>
      <div
        className={cn(
          "border-b px-2 py-1 text-center text-sm font-semibold",
          nodo.raiz ? "border-amber-400 bg-amber-200 text-amber-950" : "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100",
        )}
      >
        {nodo.tipo}
      </div>
      <div className="space-y-0.5 px-2 py-1 text-right text-xs tabular-nums">
        <div className="truncate font-medium" title={nodo.numero}>{nodo.numero}</div>
        <div className="text-muted-foreground">{nodo.fecha ?? "—"}</div>
        <div className="text-muted-foreground">{nodo.monto != null ? `$ ${pesos(nodo.monto)}` : " "}</div>
        <div className="text-muted-foreground">{nodo.estado ? (ETIQUETA_ESTADO[nodo.estado] ?? nodo.estado) : " "}</div>
      </div>
      {nodo.raiz && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-amber-300" />}
    </>
  );
  const clases = cn(
    "absolute block overflow-hidden rounded-sm border bg-card text-card-foreground shadow-md",
    nodo.raiz ? "border-amber-400" : "border-sky-300 dark:border-sky-800",
    enlace && "transition hover:shadow-lg hover:ring-2 hover:ring-sky-400",
  );
  const estilo = { left: pos.x, top: pos.y, width: TARJETA.ancho, height: TARJETA.alto };
  return enlace ? (
    <Link href={nodo.href!} className={clases} style={estilo} title={`Abrir ${nodo.tipo} ${nodo.numero}`}>
      {contenido}
    </Link>
  ) : (
    <div className={clases} style={estilo} aria-current={nodo.raiz ? "true" : undefined}>
      {contenido}
    </div>
  );
}

function Diagrama({ mapa }: { mapa: MapaRelacionesDTO }) {
  const d = useMemo(() => disponerGrafo(mapa), [mapa]);
  const desplazamientoY = mapa.socio ? ALTO_SOCIO + 28 : 0;
  return (
    <div className="max-h-[68vh] overflow-auto rounded-md border bg-background p-2">
      <div className="relative" style={{ width: Math.max(d.ancho, 260), height: d.alto + desplazamientoY }}>
        {mapa.socio && (
          <Link
            href={mapa.socio.href}
            className="absolute block overflow-hidden rounded-sm border border-sky-300 bg-card text-sm shadow-md hover:ring-2 hover:ring-sky-400 dark:border-sky-800"
            style={{ left: TARJETA.margen, top: TARJETA.margen, width: 250 }}
            title="Abrir socio de negocios"
          >
            <div className="border-b bg-sky-100 px-2 py-1 text-center font-semibold text-sky-950 dark:bg-sky-950 dark:text-sky-100">
              Socio de negocios
            </div>
            <div className="px-2 py-1">
              <div className="font-mono text-xs">{formatearRut(mapa.socio.rut)}</div>
              <div className="truncate" title={mapa.socio.razonSocial}>{mapa.socio.razonSocial}</div>
            </div>
          </Link>
        )}
        <svg
          className="pointer-events-none absolute left-0 top-0 text-sky-400"
          width={Math.max(d.ancho, 260)}
          height={d.alto + desplazamientoY}
          aria-hidden
        >
          <defs>
            <marker id="mapa-flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
          </defs>
          {d.flechas.map((f) => {
            const y1 = f.y1 + desplazamientoY;
            const y2 = f.y2 + desplazamientoY;
            const dx = Math.max(24, (f.x2 - f.x1) / 2);
            const xm = (f.x1 + f.x2) / 2;
            const ym = (y1 + y2) / 2;
            return (
              <g key={`${f.desde}>${f.hasta}|${f.tipo}`}>
                <path
                  d={`M${f.x1},${y1} C${f.x1 + dx},${y1} ${f.x2 - dx},${y2} ${f.x2},${y2}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  markerEnd="url(#mapa-flecha)"
                />
                <text
                  x={xm}
                  y={ym - 8}
                  textAnchor="middle"
                  className="fill-foreground text-[11px]"
                  style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4 }}
                >
                  {ETIQUETA_RELACION[f.tipo]}
                </text>
                {f.detalle && (
                  <text
                    x={xm}
                    y={ym + 15}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                    style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4 }}
                  >
                    {f.detalle}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="absolute left-0 top-0" style={{ transform: `translateY(${desplazamientoY}px)` }}>
          {mapa.nodos.map((n) => (
            <Tarjeta key={n.clave} nodo={n} pos={d.posiciones.get(n.clave)!} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Cómo se relaciona este documento con los demás: origen, derivados, pagos y asientos. */
export function MapaRelacionesDialog({ empresaId, tabla, id }: { empresaId: string; tabla: string; id: string }) {
  const [abierto, setAbierto] = useState(false);
  const [mapa, setMapa] = useState<MapaRelacionesDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrir() {
    setAbierto(true);
    setMapa(null);
    startTransition(async () => {
      const r = await mapaRelacionesAction(empresaId, tabla, id);
      if (r.ok) setMapa(r.mapa);
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
        title="Mapa de relaciones"
        aria-label="Mapa de relaciones"
      >
        <WorkflowIcon />
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="w-[min(96vw,1200px)] max-w-none sm:max-w-none">
          <DialogHeader>
            <DialogTitle>Mapa de relaciones</DialogTitle>
            <DialogDescription>
              De dónde viene este documento y qué se generó a partir de él, hasta sus pagos y asientos. Haz clic en un documento para abrirlo.
            </DialogDescription>
          </DialogHeader>
          {isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {mapa && mapa.nodos.length <= 1 && (
            <p className="text-sm text-muted-foreground">Este documento no tiene relaciones con otros registros.</p>
          )}
          {mapa && mapa.nodos.length > 1 && <Diagrama mapa={mapa} />}
          {mapa?.truncado && (
            <p className="text-xs text-muted-foreground">
              El mapa es muy grande y se muestra incompleto. Abre un documento más cercano para ver su detalle.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
