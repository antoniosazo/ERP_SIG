import { notFound } from "next/navigation";
import {
  listarCentrosCosto,
  listarImpuestosDeEmpresa,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  listarTerceros,
  listarTiposDocumento,
  obtenerDocumentoCompraConLineas,
} from "@erp/db";
import { formatearRut } from "@erp/shared";
import { DocumentoPrintAuto } from "@/components/panel/documento-print-auto";

export const dynamic = "force-dynamic";

const clp = (v: unknown) => Number(v).toLocaleString("es-CL", { maximumFractionDigits: 4 });

export default async function ImprimirDocumentoCompraPage({
  params,
}: {
  params: Promise<{ empresaId: string; docId: string }>;
}) {
  const { empresaId, docId } = await params;
  const detalle = await obtenerDocumentoCompraConLineas(docId, empresaId);
  if (!detalle) notFound();
  const { documento: d, lineas } = detalle;

  const [terceros, tiposDoc, cuentas, impuestos, centros, monedas] = await Promise.all([
    listarTerceros(empresaId),
    listarTiposDocumento(),
    listarPlanCuentasDeEmpresa(empresaId),
    listarImpuestosDeEmpresa(empresaId),
    listarCentrosCosto(empresaId),
    listarMonedasDeEmpresa(empresaId),
  ]);

  const proveedor = terceros.find((t) => t.id === d.terceroId);
  const tipoDoc = tiposDoc.find((t) => t.id === d.tipoDocumentoId);
  const moneda = monedas.find((m) => m.id === d.monedaId);
  const cuentaNombre = new Map(cuentas.map((c) => [c.id, `${c.codigoCuenta} — ${c.nombreCuenta}`]));
  const impuestoNombre = new Map(impuestos.map((i) => [i.id, i.codigo]));
  const centroNombre = new Map(centros.map((c) => [c.id, `${c.codigo} — ${c.nombre}`]));

  const filaDato = (k: string, v: string) => (
    <div>
      <dt className="text-[11px] tracking-wide text-neutral-500 uppercase">{k}</dt>
      <dd className="text-sm">{v || "—"}</dd>
    </div>
  );

  return (
    <div id="doc-print" className="mx-auto max-w-3xl text-neutral-900">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #doc-print, #doc-print * { visibility: visible !important; }
          #doc-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 8mm; }
          .no-print { display: none !important; }
          @page { margin: 14mm; }
        }
      `}</style>

      <DocumentoPrintAuto />

      <header className="flex items-start justify-between border-b-2 border-neutral-800 pb-3">
        <div>
          <h1 className="text-lg font-semibold">{d.docTipo}</h1>
          <p className="text-sm text-neutral-600">
            {tipoDoc ? `${tipoDoc.codigoSii} — ${tipoDoc.nombre}` : ""}
          </p>
        </div>
        <div className="text-right text-sm">
          <p>
            <span className="text-neutral-500">N° interno:</span>{" "}
            <span className="font-mono font-medium">{d.numeroInterno ?? "—"}</span>
          </p>
          <p>
            <span className="text-neutral-500">Folio SII:</span>{" "}
            <span className="font-mono font-medium">{d.folio ?? "—"}</span>
          </p>
          <p>
            <span className="text-neutral-500">Estado:</span> {d.estado}
          </p>
        </div>
      </header>

      <dl className="my-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
        {filaDato("Proveedor", proveedor?.razonSocial ?? "—")}
        {filaDato("RUT", proveedor?.rut ? formatearRut(proveedor.rut) : "—")}
        {filaDato("Moneda", moneda ? `${moneda.codigo} — ${moneda.nombre}` : "—")}
        {filaDato("Fecha del documento", d.fechaEmision)}
        {filaDato("Fecha de vencimiento", d.fechaVencimiento ?? "—")}
        {filaDato("Fecha de contabilización", d.fechaContabilizacion ?? "—")}
        {d.numAtCard ? filaDato("N° del documento del proveedor", d.numAtCard) : null}
        {Number(d.tipoCambio) !== 1 ? filaDato("Tipo de cambio", clp(d.tipoCambio)) : null}
        {Number(d.descuentoGlobalPct) > 0
          ? filaDato("Descuento global", `${clp(d.descuentoGlobalPct)} %`)
          : null}
      </dl>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-neutral-400 text-left text-[11px] tracking-wide text-neutral-500 uppercase">
            <th className="py-1.5 pr-2">Glosa</th>
            <th className="py-1.5 pr-2">Cuenta de imputación</th>
            <th className="py-1.5 pr-2">Centro de costo</th>
            <th className="py-1.5 pr-2 text-right">Cant.</th>
            <th className="py-1.5 pr-2 text-right">P. unit.</th>
            <th className="py-1.5 pr-2 text-right">Desc.%</th>
            <th className="py-1.5 pr-2 text-right">Neto</th>
            <th className="py-1.5 text-right">IVA</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={l.id} className="border-b border-neutral-200 align-top">
              <td className="py-1.5 pr-2">
                {l.glosa ?? "—"}
                {l.esExento ? <span className="text-neutral-500"> (exento)</span> : null}
              </td>
              <td className="py-1.5 pr-2">{cuentaNombre.get(l.cuentaImputacionId) ?? "—"}</td>
              <td className="py-1.5 pr-2">
                {l.centroCostoId ? (centroNombre.get(l.centroCostoId) ?? "—") : "—"}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{clp(l.cantidad)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{clp(l.precioUnitario)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{clp(l.descuentoLineaPct)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{clp(l.montoNeto)}</td>
              <td className="py-1.5 text-right tabular-nums">
                {l.impuestoId
                  ? `${impuestoNombre.get(l.impuestoId) ?? ""} ${clp(l.montoImpuesto)}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">Neto</span>
          <span className="tabular-nums">{clp(d.montoNeto)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Exento</span>
          <span className="tabular-nums">{clp(d.montoExento)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">IVA</span>
          <span className="tabular-nums">{clp(d.montoImpuesto)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-400 pt-1 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{clp(d.montoTotal)}</span>
        </div>
      </div>

      {d.glosa ? (
        <p className="mt-6 text-sm">
          <span className="text-neutral-500">Glosa:</span> {d.glosa}
        </p>
      ) : null}
    </div>
  );
}
