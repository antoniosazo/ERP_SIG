import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listarBancos,
  listarMetodosPago,
  listarPagos,
  listarTerceros,
  obtenerPagoConDetalle,
} from "@erp/db";
import type { PagoTipo } from "@erp/shared";
import { PAGO_META } from "@/lib/pagos";
import { AsientoTabla } from "@/components/panel/asiento-tabla";
import { PagoAnularBoton } from "@/components/panel/pago-anular-boton";
import { PagoForm } from "@/components/panel/pago-form";
import { PagosLista } from "@/components/panel/pagos-lista";
import { VolverBoton } from "@/components/panel/volver-boton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

const fmt = (n: number) => n.toLocaleString("es-CL");

export async function PagosListaPage({ empresaId, tipo }: { empresaId: string; tipo: PagoTipo }) {
  const meta = PAGO_META[tipo];
  const pagos = await listarPagos(empresaId, tipo);
  return (
    <>
      <TypographyHeading
        title={meta.titulo}
        description={
          tipo === "Recibido"
            ? "Cobros a clientes. Se contabilizan al registrarse: banco o caja contra la cuenta del cliente."
            : "Pagos a proveedores. Se contabilizan al registrarse: cuenta del proveedor contra banco o caja."
        }
      />
      <PagosLista
        empresaId={empresaId}
        tipo={tipo}
        filas={pagos.map((p) => ({
          id: p.id,
          numeroInterno: p.numeroInterno,
          fechaPago: p.fechaPago,
          tercero: p.tercero,
          medios: p.medios,
          montoTotal: Number(p.montoTotal),
          montoAplicado: Number(p.montoAplicado),
          estado: p.estado,
        }))}
      />
    </>
  );
}

export async function PagoNuevoPage({ empresaId, tipo }: { empresaId: string; tipo: PagoTipo }) {
  const meta = PAGO_META[tipo];
  const [terceros, metodos, bancos] = await Promise.all([
    listarTerceros(empresaId),
    listarMetodosPago(empresaId),
    listarBancos(),
  ]);
  return (
    <>
      <TypographyHeading
        title={`Nuevo ${meta.singular}`}
        description="Selecciona los documentos a saldar y los medios. Lo que exceda lo aplicado queda como anticipo."
      />
      <PagoForm
        empresaId={empresaId}
        tipo={tipo}
        terceros={terceros
          .filter((t) => t.tipoTercero === meta.terceroTipo && t.activo)
          .map((t) => ({ id: t.id, label: `${t.razonSocial} (${t.rut})` }))}
        metodos={metodos
          .filter((m) => m.activo && (m.sentido === "Ambos" || m.sentido === tipo))
          .map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo }))}
        bancos={bancos.map((b) => ({ id: b.id, label: b.nombre }))}
      />
    </>
  );
}

export async function PagoDetallePage({
  empresaId,
  tipo,
  pagoId,
}: {
  empresaId: string;
  tipo: PagoTipo;
  pagoId: string;
}) {
  const meta = PAGO_META[tipo];
  const d = await obtenerPagoConDetalle(pagoId, empresaId);
  if (!d || d.pago.tipo !== tipo) notFound();
  const { pago, tercero, medios, aplicaciones, asiento, reversa } = d;
  const total = Number(pago.montoTotal);
  const aplicado = Number(pago.montoAplicado);
  const anulado = pago.estado === "anulado";
  const rutaDoc = (origen: "venta" | "compra", id: string) =>
    `/panel/${empresaId}/${origen === "venta" ? "ventas" : "compras"}/documentos/${id}`;

  return (
    <>
      <VolverBoton fallbackHref={`/panel/${empresaId}/tesoreria/${meta.slug}`} />
      <TypographyHeading
        title={`${meta.titulo.slice(0, -1)} ${pago.numeroInterno}`}
        description={`${meta.tercero}: ${tercero?.razonSocial ?? "—"} (${tercero?.rut ?? ""})`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={anulado ? "secondary" : "default"}>{anulado ? "Anulado" : "Contabilizado"}</Badge>
        {!anulado && <PagoAnularBoton empresaId={empresaId} pagoId={pago.id} />}
        {anulado && pago.motivoAnulacion && (
          <span className="text-sm text-muted-foreground">Motivo: {pago.motivoAnulacion}</span>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta={`Fecha del ${meta.accion}`}>{pago.fechaPago}</Dato>
          <Dato etiqueta="Fecha de contabilización">{pago.fechaContabilizacion}</Dato>
          <Dato etiqueta="Total">{fmt(total)}</Dato>
          <Dato etiqueta="Aplicado a documentos">{fmt(aplicado)}</Dato>
          {total - aplicado > 0.005 && <Dato etiqueta="Anticipo (sin documento)">{fmt(total - aplicado)}</Dato>}
          {pago.referencia && <Dato etiqueta="Referencia">{pago.referencia}</Dato>}
          {pago.glosa && <Dato etiqueta="Glosa">{pago.glosa}</Dato>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medios</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">Método</th>
                <th>Cuenta contable</th>
                <th>Detalle</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {medios.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="py-1.5">
                    {m.metodo} <span className="text-xs text-muted-foreground">({m.tipo})</span>
                  </td>
                  <td>
                    {m.cuentaCodigo} — {m.cuentaNombre}
                  </td>
                  <td className="text-muted-foreground">
                    {[m.referencia, m.chequeNumero && `cheque ${m.chequeNumero}`, m.chequeBanco, m.fechaCobro && `cobro ${m.fechaCobro}`]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="text-right tabular-nums">{fmt(Number(m.monto))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos pagados</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {aplicaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin documentos: todo el monto es anticipo.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1">Documento</th>
                  <th>Folio</th>
                  <th>Emisión</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Aplicado</th>
                </tr>
              </thead>
              <tbody>
                {aplicaciones.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-1.5">
                      <Link href={rutaDoc(a.origen, a.documentoId)} className="hover:underline">
                        {a.tipo} <span className="font-mono text-muted-foreground">{a.numeroInterno}</span>
                      </Link>
                      {a.montoAplicado < 0 && (
                        <span className="ml-2 text-xs text-destructive">reapertura por cheque protestado</span>
                      )}
                    </td>
                    <td className="font-mono">{a.folio ?? "—"}</td>
                    <td>{a.fechaEmision}</td>
                    <td className="text-right tabular-nums">{fmt(a.total)}</td>
                    <td className="text-right tabular-nums">{fmt(a.montoAplicado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {asiento && <AsientoTabla a={asiento} titulo="Asiento" />}
      {reversa && <AsientoTabla a={reversa} titulo="Asiento de reversa" />}
    </>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
