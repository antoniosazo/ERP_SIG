"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  cambiarEstadoBandejaAction,
  cargarBandejaAction,
  descargarXmlAhoraAction,
} from "@/lib/actions/sii-bandeja";
import { Button } from "@/components/ui/button";
import { FacturaDialog } from "@/components/panel/factura-vista";
import { NOMBRE_DTE, type FacturaDatos } from "@/lib/factura-vista";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FilaBandeja = {
  id: string;
  tipoDte: number;
  folio: string;
  rutContraparte: string;
  razonSocial: string | null;
  fechaEmision: string;
  montoNeto: number;
  montoExento: number;
  montoIva: number;
  montoTotal: number;
  error: string | null;
  rutEmisor: string;
  razonSocialEmisor: string;
  rutReceptor: string;
  razonSocialReceptor: string;
  lineas: {
    nombre: string;
    descripcion?: string;
    cantidad?: number;
    precioUnitario?: number;
    montoItem: number;
    exento: boolean;
  }[];
  referencias: { tipoDocRef: string; folioRef: string; fechaRef?: string; razonRef?: string }[];
};

type EstadoBandeja = "pendiente" | "cargado" | "descartado";

const clp = (n: number) => n.toLocaleString("es-CL");

function deFilaBandeja(f: FilaBandeja): FacturaDatos {
  return {
    titulo: NOMBRE_DTE[f.tipoDte] ?? `Documento tipo ${f.tipoDte}`,
    folio: f.folio,
    fechaEmision: f.fechaEmision,
    emisor: { razonSocial: f.razonSocialEmisor, rut: f.rutEmisor },
    receptor: { razonSocial: f.razonSocialReceptor, rut: f.rutReceptor },
    lineas: f.lineas,
    referencias: f.referencias,
    montoNeto: f.montoNeto,
    montoExento: f.montoExento,
    montoIva: f.montoIva,
    montoTotal: f.montoTotal,
    pie: "Copia de trabajo generada desde el XML del SII. No es la representación impresa oficial (sin timbre electrónico).",
    aviso: f.error,
  };
}

const ESTADOS: { valor: EstadoBandeja; etiqueta: string }[] = [
  { valor: "pendiente", etiqueta: "Por validar" },
  { valor: "cargado", etiqueta: "Cargados" },
  { valor: "descartado", etiqueta: "Descartados" },
];

export function BandejaSii({
  empresaId,
  origen,
  estado,
  filas,
  ultimaDescargaEn,
  ultimaDescargaDetalle,
}: {
  empresaId: string;
  origen: "compra" | "venta";
  estado: EstadoBandeja;
  filas: FilaBandeja[];
  ultimaDescargaEn: string | null;
  ultimaDescargaDetalle: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ver, setVer] = useState<FilaBandeja | null>(null);
  const [dias, setDias] = useState(7);
  const base = `/panel/${empresaId}/${origen === "compra" ? "compras" : "ventas"}/bandeja-sii`;
  const etiquetaOrigen = origen === "compra" ? "compra" : "venta";
  const contraparte = origen === "compra" ? "Proveedor" : "Cliente";

  const todas = filas.length > 0 && sel.size === filas.length;
  function alternar(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function descargar() {
    startTransition(async () => {
      const r = await descargarXmlAhoraAction(empresaId, dias);
      if (r.ok) toast.success(r.detalle);
      else toast.error(r.error);
      router.refresh();
    });
  }

  function cargar(ids: string[]) {
    startTransition(async () => {
      const r = await cargarBandejaAction(empresaId, ids);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.errores === 0) toast.success(`${r.cargados} documento(s) cargado(s): las facturas quedan contabilizadas.`);
      else toast.error(`${r.cargados} cargado(s), ${r.errores} con error: ${r.detalle.find((d) => d.resultado)?.resultado ?? ""}`);
      setSel(new Set());
      router.refresh();
    });
  }

  function cambiar(ids: string[], nuevo: "pendiente" | "descartado") {
    startTransition(async () => {
      const r = await cambiarEstadoBandejaAction(empresaId, ids, nuevo);
      if (r.ok) {
        toast.success(nuevo === "descartado" ? "Descartado(s)." : "Devuelto(s) a la bandeja.");
        setSel(new Set());
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const ids = [...sel];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3 text-sm">
        <div className="min-w-0 flex-1 text-muted-foreground">
          <p>
            Los XML del SII se descargan solos cada hora y quedan aquí para que los valides antes
            de crear el documento de {etiquetaOrigen}; las facturas quedan contabilizadas al cargarlas.
          </p>
          <p className="mt-1 text-xs">
            Última descarga:{" "}
            {ultimaDescargaEn
              ? `${new Date(ultimaDescargaEn).toLocaleString("es-CL")} — ${ultimaDescargaDetalle ?? ""}`
              : "aún no se ha ejecutado."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            disabled={isPending}
          >
            {[7, 15, 30, 60].map((d) => (
              <option key={d} value={d}>
                Últimos {d} días
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={descargar} disabled={isPending}>
            {isPending ? "Trabajando…" : "Descargar ahora"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {ESTADOS.map((e) => (
            <Button key={e.valor} asChild size="sm" variant={estado === e.valor ? "default" : "outline"}>
              <Link href={`${base}?estado=${e.valor}`}>{e.etiqueta}</Link>
            </Button>
          ))}
        </div>
        {estado === "pendiente" && (
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending || ids.length === 0} onClick={() => cargar(ids)}>
              Cargar seleccionados ({ids.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending || ids.length === 0}
              onClick={() => cambiar(ids, "descartado")}
            >
              Descartar
            </Button>
          </div>
        )}
        {estado === "descartado" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || ids.length === 0}
            onClick={() => cambiar(ids, "pendiente")}
          >
            Devolver a la bandeja ({ids.length})
          </Button>
        )}
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay documentos en este estado.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  {estado !== "cargado" && (
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={todas}
                      onChange={() => setSel(todas ? new Set() : new Set(filas.map((f) => f.id)))}
                    />
                  )}
                </TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="w-24">Folio</TableHead>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead>{contraparte}</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f) => (
                <TableRow
                  key={f.id}
                  className="cursor-pointer"
                  onClick={() => setVer(f)}
                  title="Ver documento"
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {estado !== "cargado" && (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar folio ${f.folio}`}
                        checked={sel.has(f.id)}
                        onChange={() => alternar(f.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {NOMBRE_DTE[f.tipoDte] ?? `Tipo ${f.tipoDte}`}
                    {f.error && <div className="text-xs text-destructive">{f.error}</div>}
                  </TableCell>
                  <TableCell>{f.folio}</TableCell>
                  <TableCell>{f.fechaEmision}</TableCell>
                  <TableCell>
                    <div>{f.razonSocial ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{f.rutContraparte}</div>
                  </TableCell>
                  <TableCell className="text-right">{clp(f.montoNeto + f.montoExento)}</TableCell>
                  <TableCell className="text-right">{clp(f.montoIva)}</TableCell>
                  <TableCell className="text-right">{clp(f.montoTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <FacturaDialog f={ver ? deFilaBandeja(ver) : null} onClose={() => setVer(null)} />
    </div>
  );
}
