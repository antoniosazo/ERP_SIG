import { notFound } from "next/navigation";
import { obtenerDocumentoActivoFijoParaConsulta } from "@erp/db";
import { uuid } from "@erp/shared";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { EnlaceDetalle } from "@/components/panel/enlace-detalle";
import { VolverBoton } from "@/components/panel/volver-boton";
import { TypographyHeading } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ empresaId: string; documentoId: string }> }) {
  const { empresaId, documentoId } = await params;
  if (!uuid.safeParse(documentoId).success || !await obtenerAccesoEmpresa(empresaId)) notFound();
  const detalle = await obtenerDocumentoActivoFijoParaConsulta(empresaId, documentoId);
  if (!detalle) notFound();
  const { documento: d, lineas } = detalle;
  const base = `/panel/${empresaId}`;
  return <div className="space-y-4">
    <VolverBoton fallbackHref={`${base}/activos-fijos/activos`} />
    <TypographyHeading title={`${d.tipoDoc} N° ${d.numero} · ${d.anio}`} description={d.glosa ?? "Documento de activo fijo"} />
    <Card><CardContent className="flex flex-wrap gap-4 pt-6 text-sm">
      <span>Fecha: {d.fecha}</span><span>Fecha contable: {d.fechaContabilizacion ?? "—"}</span><span>Estado: {d.estado}</span><span>Libro: {d.libro ?? "Todos"}</span>
      {d.asientoId && <EnlaceDetalle href={`${base}/contabilidad/asientos/${d.asientoId}`}>Ver asiento</EnlaceDetalle>}
      {d.asientoReversaId && <EnlaceDetalle href={`${base}/contabilidad/asientos/${d.asientoReversaId}`}>Ver reversa</EnlaceDetalle>}
      {d.motivoAnulacion && <p>Motivo de anulación: {d.motivoAnulacion}</p>}
    </CardContent></Card>
    <Table><TableHeader><TableRow><TableHead>Activo</TableHead><TableHead>Libro</TableHead><TableHead>Glosa</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
      <TableBody>{lineas.map((l) => <TableRow key={l.id}>
        <TableCell><EnlaceDetalle href={`${base}/activos-fijos/activos/${l.activoId}`}>{l.codigo} · {l.descripcion}</EnlaceDetalle></TableCell>
        <TableCell>{l.libro}</TableCell><TableCell>{l.glosa ?? "—"}</TableCell><TableCell className="text-right tabular-nums">{Number(l.importe).toLocaleString("es-CL", { maximumFractionDigits: 4 })}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </div>;
}
