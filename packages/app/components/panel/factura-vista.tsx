"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FacturaDatos } from "@/lib/factura-vista";
import { descargarPdfFactura } from "@/lib/pdf-dte";

const clp = (n: number) => n.toLocaleString("es-CL");

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** Contenido de la vista de factura: cabecera, detalle, totales con impuestos y botón de PDF. */
export function VistaFactura({ f }: { f: FacturaDatos }) {
  const [generando, setGenerando] = useState(false);
  const tasa = f.montoNeto > 0 && f.montoIva > 0 ? Math.round((f.montoIva / f.montoNeto) * 100) : 0;
  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between gap-3 pr-8">
          <DialogTitle>
            {f.titulo} N° {f.folio}
          </DialogTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={generando}
            onClick={async () => {
              setGenerando(true);
              try {
                await descargarPdfFactura(f);
              } catch {
                toast.error("No se pudo generar el PDF.");
              } finally {
                setGenerando(false);
              }
            }}
          >
            {generando ? "Generando…" : "Descargar PDF"}
          </Button>
        </div>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Emisor</p>
          <Dato etiqueta="Razón social">{f.emisor.razonSocial || "—"}</Dato>
          <Dato etiqueta="RUT">{f.emisor.rut || "—"}</Dato>
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Receptor</p>
          <Dato etiqueta="Razón social">{f.receptor.razonSocial || "—"}</Dato>
          <Dato etiqueta="RUT">{f.receptor.rut || "—"}</Dato>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Dato etiqueta="Fecha de emisión">{f.fechaEmision.slice(0, 10)}</Dato>
        <Dato etiqueta="Documento">{f.titulo}</Dato>
        <Dato etiqueta="Folio">{f.folio}</Dato>
        {(f.extras ?? []).map((e) => (
          <Dato key={e.etiqueta} etiqueta={e.etiqueta}>
            {e.valor}
          </Dato>
        ))}
      </div>

      {f.referencias.length > 0 && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Referencias</p>
          {f.referencias.map((r, i) => (
            <p key={i}>
              Doc. {r.tipoDocRef} N° {r.folioRef}
              {r.fechaRef ? ` del ${r.fechaRef}` : ""}
              {r.razonRef ? ` — ${r.razonRef}` : ""}
            </p>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2 text-right">Cant.</th>
              <th className="px-3 py-2 text-right">Precio unit.</th>
              <th className="px-3 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {f.lineas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-muted-foreground">
                  Sin líneas de detalle.
                </td>
              </tr>
            )}
            {f.lineas.map((l, i) => (
              <tr key={i} className="border-t align-top">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">
                  <div>
                    {l.nombre}
                    {l.exento ? " (exento)" : ""}
                  </div>
                  {l.descripcion && <div className="text-xs text-muted-foreground">{l.descripcion}</div>}
                </td>
                <td className="px-3 py-2 text-right">{l.cantidad ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {l.precioUnitario != null ? clp(l.precioUnitario) : "—"}
                </td>
                <td className="px-3 py-2 text-right">{clp(l.montoItem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
        {f.montoNeto > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto neto</span>
            <span>{clp(f.montoNeto)}</span>
          </div>
        )}
        {f.montoExento > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto exento</span>
            <span>{clp(f.montoExento)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">IVA{tasa ? ` (${tasa}%)` : ""}</span>
          <span>{clp(f.montoIva)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 text-base font-semibold">
          <span>Total</span>
          <span>{clp(f.montoTotal)}</span>
        </div>
      </div>

      {f.aviso && <p className="text-xs text-destructive">{f.aviso}</p>}
    </>
  );
}

/** Diálogo con la vista de factura, controlado desde fuera (ej. clic en una fila). */
export function FacturaDialog({ f, onClose }: { f: FacturaDatos | null; onClose: () => void }) {
  return (
    <Dialog open={f !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {f && <VistaFactura f={f} />}
      </DialogContent>
    </Dialog>
  );
}

/** Botón "Ver factura / PDF" para las barras de herramientas de un documento. */
export function VerFacturaBoton({ f }: { f: FacturaDatos }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
        Ver factura / PDF
      </Button>
      <FacturaDialog f={abierto ? f : null} onClose={() => setAbierto(false)} />
    </>
  );
}
