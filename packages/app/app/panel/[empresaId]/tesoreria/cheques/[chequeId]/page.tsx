import { notFound } from "next/navigation";
import { obtenerChequeParaConsulta } from "@erp/db";
import { puedeEditarFinanzas, uuid } from "@erp/shared";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { MapaRelacionesDialog } from "@/components/panel/mapa-relaciones-dialog";
import { EnlaceDetalle } from "@/components/panel/enlace-detalle";
import { VolverBoton } from "@/components/panel/volver-boton";
import { TypographyHeading } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ empresaId: string; chequeId: string }> }) {
  const { empresaId, chequeId } = await params;
  const acceso = uuid.safeParse(chequeId).success ? await obtenerAccesoEmpresa(empresaId) : null;
  if (!acceso) notFound();
  const d = await obtenerChequeParaConsulta(empresaId, chequeId);
  if (!d) notFound();
  const c = d.cheque;
  const base = `/panel/${empresaId}`;
  return <div className="space-y-4">
    <VolverBoton fallbackHref={`${base}/tesoreria/cheques?estado=todos`} />
    <TypographyHeading title={`Cheque ${c.numero}`} description={`${c.tipo} · ${d.banco ?? "Sin banco"}`} />
    {puedeEditarFinanzas(acceso.session.user.esAdminFirma, acceso.rol) && <div><MapaRelacionesDialog empresaId={empresaId} tabla="cheques" id={chequeId} /></div>}
    <Card><CardContent className="space-y-3 pt-6 text-sm">
      <p>Estado: {c.estado.replaceAll("_", " ")}</p><p>Emisión: {c.fechaEmision} · Cobro: {c.fechaCobro ?? "A la vista"}</p>
      <p>Monto: {Number(c.monto).toLocaleString("es-CL", { maximumFractionDigits: 4 })}</p>
      {d.tercero && <p><EnlaceDetalle href={`${base}/maestros/terceros/${c.terceroId}`}>{d.tercero}</EnlaceDetalle></p>}
      <p><EnlaceDetalle href={`${base}/tesoreria/${d.pagoTipo === "Recibido" ? "pagos-recibidos" : "pagos-efectuados"}/${c.pagoId}`}>Pago {d.pagoNumero}</EnlaceDetalle></p>
      {c.depositoId && <p><EnlaceDetalle href={`${base}/tesoreria/depositos/${c.depositoId}`}>Ver depósito</EnlaceDetalle></p>}
      {c.asientoProtestoId && <p><EnlaceDetalle href={`${base}/contabilidad/asientos/${c.asientoProtestoId}`}>Ver asiento de protesto</EnlaceDetalle></p>}
      {c.motivoProtesto && <p>Motivo del protesto: {c.motivoProtesto}</p>}
    </CardContent></Card>
  </div>;
}
