import Link from "next/link";
import { cuentaCorrienteTercero, type DocumentoAbierto } from "@erp/db";
import { FilaEnlace } from "@/components/panel/fila-enlace";
import { FlechaDetalle } from "@/components/panel/flecha-detalle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ETIQUETA_ORIGEN, rutaOrigen } from "@/lib/origen-asiento";

const fmt = (n: number) => n.toLocaleString("es-CL");
const hoy = () => new Date().toISOString().slice(0, 10);

function Indicador({ etiqueta, valor, nota, peligro }: { etiqueta: string; valor: number; nota?: string; peligro?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{etiqueta}</div>
        <div className={`text-lg font-semibold tabular-nums ${peligro || valor < 0 ? "text-destructive" : ""}`}>{fmt(valor)}</div>
        {nota && <div className="text-xs text-muted-foreground">{nota}</div>}
      </CardContent>
    </Card>
  );
}

function TablaAbiertos({ titulo, docs, base }: { titulo: string; docs: DocumentoAbierto[]; base: string }) {
  if (docs.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1">Documento</th>
              <th>Folio</th>
              <th>Emisión</th>
              <th>Vencimiento</th>
              <th className="text-right">Total</th>
              <th className="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const vencido = d.fechaVencimiento && d.fechaVencimiento < hoy();
              return (
                <tr key={d.id} className="border-t">
                  <td className="py-1.5">
                    <Link href={`${base}/${d.id}`} className="hover:underline">
                      {d.tipo} <span className="font-mono text-muted-foreground">{d.numeroInterno}</span>
                    </Link>
                  </td>
                  <td className="font-mono">{d.folio ?? "—"}</td>
                  <td>{d.fechaEmision}</td>
                  <td className={vencido ? "text-destructive" : ""}>
                    {d.fechaVencimiento ?? "—"}
                    {vencido ? " (vencido)" : ""}
                  </td>
                  <td className="text-right tabular-nums">{fmt(d.total)}</td>
                  <td className="text-right tabular-nums">{fmt(d.saldo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/** Saldos, documentos abiertos y movimientos de un socio de negocio (cuenta corriente). */
export async function TerceroCuentaCorriente({
  empresaId,
  terceroId,
  tipoTercero,
}: {
  empresaId: string;
  terceroId: string;
  tipoTercero: string;
}) {
  const cc = await cuentaCorrienteTercero(empresaId, terceroId, hoy());
  if (!cc) return null;
  const { saldo } = cc;
  const mostrarCobrar = tipoTercero === "Cliente" || saldo.porCobrar !== 0;
  const mostrarPagar = tipoTercero === "Proveedor" || saldo.porPagar !== 0;
  if (!mostrarCobrar && !mostrarPagar) return null;

  const disponible = cc.limiteCredito > 0 ? cc.limiteCredito - saldo.porCobrar : null;
  // Saldo acumulado por tipo de cuenta, calculado antes de dibujar.
  const acumulado = new Map<string, number>();
  const filas = cc.movimientos.map((m) => {
    const delta = m.tipoCuenta === "Cliente" ? m.debe - m.haber : m.haber - m.debe;
    const total = Math.round(((acumulado.get(m.tipoCuenta) ?? 0) + delta) * 100) / 100;
    acumulado.set(m.tipoCuenta, total);
    return { m, total };
  });
  const dosTipos = new Set(cc.movimientos.map((m) => m.tipoCuenta)).size > 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mostrarCobrar && <Indicador etiqueta="Por cobrar (cliente)" valor={saldo.porCobrar} />}
        {mostrarPagar && <Indicador etiqueta="Por pagar (proveedor)" valor={saldo.porPagar} />}
        {disponible !== null && mostrarCobrar && (
          <Indicador
            etiqueta="Crédito disponible"
            valor={disponible}
            nota={`Límite ${fmt(cc.limiteCredito)}`}
            peligro={disponible < 0}
          />
        )}
        {Math.abs(cc.anticiposPorCobrar) > 0.5 && mostrarCobrar && (
          <Indicador etiqueta="Anticipos / otros del cliente" valor={-cc.anticiposPorCobrar} nota="Saldo a favor del cliente si es negativo" />
        )}
        {Math.abs(cc.anticiposPorPagar) > 0.5 && mostrarPagar && (
          <Indicador etiqueta="Anticipos / otros al proveedor" valor={-cc.anticiposPorPagar} nota="Saldo a favor nuestro si es negativo" />
        )}
      </div>

      <TablaAbiertos titulo="Facturas por cobrar" docs={cc.abiertosVenta} base={`/panel/${empresaId}/ventas/documentos`} />
      <TablaAbiertos titulo="Facturas por pagar" docs={cc.abiertosCompra} base={`/panel/${empresaId}/compras/documentos`} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos de la cuenta corriente</CardTitle>
        </CardHeader>
        <CardContent>
          {filas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos contabilizados.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Fecha</TableHead>
                    <TableHead className="w-20">Asiento</TableHead>
                    {dosTipos && <TableHead>Cuenta</TableHead>}
                    <TableHead>Glosa</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="text-right">Debe</TableHead>
                    <TableHead className="text-right">Haber</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map(({ m, total }) => {
                    const ruta = rutaOrigen(empresaId, m);
                    return (
                      <FilaEnlace key={m.lineaId} href={ruta} title="Ir al documento">
                        <TableCell className="tabular-nums text-muted-foreground">{m.fecha}</TableCell>
                        <TableCell className="font-mono">{m.correlativo}</TableCell>
                        {dosTipos && (
                          <TableCell className="text-muted-foreground">{m.tipoCuenta === "Cliente" ? "Por cobrar" : "Por pagar"}</TableCell>
                        )}
                        <TableCell>{m.glosaLinea || m.glosaAsiento}</TableCell>
                        <TableCell>
                          {ruta ? (
                            <Link href={ruta} className="hover:underline">
                              {ETIQUETA_ORIGEN[m.origenTabla ?? ""] ?? m.origenTabla}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{m.origenTabla ? (ETIQUETA_ORIGEN[m.origenTabla] ?? m.origenTabla) : "Manual"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{m.debe ? fmt(m.debe) : ""}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.haber ? fmt(m.haber) : ""}</TableCell>
                        <TableCell className={`text-right tabular-nums ${total < 0 ? "text-destructive" : ""}`}>{fmt(total)}</TableCell>
                        <TableCell className="text-right">
                          {ruta && <FlechaDetalle href={ruta} title="Ir al documento" />}
                        </TableCell>
                      </FilaEnlace>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
