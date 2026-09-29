import { notFound } from "next/navigation";
import { listarCentrosCosto } from "@erp/db";
import { uuid } from "@erp/shared";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { EnlaceDetalle } from "@/components/panel/enlace-detalle";
import { VolverBoton } from "@/components/panel/volver-boton";
import { TypographyHeading } from "@/components/ui/typography";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ empresaId: string; centroId: string }> }) {
  const { empresaId, centroId } = await params;
  if (!uuid.safeParse(centroId).success || !await obtenerAccesoEmpresa(empresaId)) notFound();
  const centros = await listarCentrosCosto(empresaId);
  const centro = centros.find((c) => c.id === centroId);
  if (!centro) notFound();
  const padre = centros.find((c) => c.id === centro.centroPadreId);
  const hijos = centros.filter((c) => c.centroPadreId === centro.id);
  const base = `/panel/${empresaId}/configuracion/centros-costo`;
  return <div className="space-y-4">
    <VolverBoton fallbackHref={base} />
    <TypographyHeading title={`${centro.codigo} · ${centro.nombre}`} description="Ficha de consulta del centro de costo" />
    <Card><CardContent className="space-y-3 pt-6 text-sm">
      <p>Estado: {centro.estado}</p>
      <p>Centro padre: {padre ? <EnlaceDetalle href={`${base}/${padre.id}`}>{padre.codigo} · {padre.nombre}</EnlaceDetalle> : "Sin padre"}</p>
      {hijos.length > 0 && <div><p className="mb-2 font-medium">Centros dependientes</p><ul className="space-y-2">{hijos.map((c) => <li key={c.id}><EnlaceDetalle href={`${base}/${c.id}`}>{c.codigo} · {c.nombre}</EnlaceDetalle></li>)}</ul></div>}
    </CardContent></Card>
  </div>;
}
