import { notFound } from "next/navigation";
import { obtenerTerceroConDetalle } from "@erp/db";
import { TerceroCuentaCorriente } from "@/components/panel/tercero-cuenta-corriente";
import { VolverBoton } from "@/components/panel/volver-boton";
import { Button } from "@/components/ui/button";
import { TypographyHeading } from "@/components/ui/typography";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Nivel 2 del socio de negocio: detalle de su cuenta (saldos, facturas abiertas y movimientos). */
export default async function CuentaTerceroPage({
  params,
}: {
  params: Promise<{ empresaId: string; terceroId: string }>;
}) {
  const { empresaId, terceroId } = await params;
  const detalle = await obtenerTerceroConDetalle(terceroId, empresaId);
  if (!detalle) notFound();
  const { tercero } = detalle;
  const ficha = `/panel/${empresaId}/maestros/terceros/${terceroId}`;

  return (
    <>
      <VolverBoton fallbackHref={ficha} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TypographyHeading
          title={`Cuenta de ${tercero.razonSocial}`}
          description={`${tercero.tipoTercero} · ${tercero.rut} · saldos, facturas abiertas y movimientos a hoy`}
        />
        <Button asChild variant="outline" size="sm">
          <Link href={ficha}>Ver datos del {tercero.tipoTercero === "Proveedor" ? "proveedor" : "cliente"}</Link>
        </Button>
      </div>
      <TerceroCuentaCorriente empresaId={empresaId} terceroId={terceroId} tipoTercero={tercero.tipoTercero} />
    </>
  );
}
