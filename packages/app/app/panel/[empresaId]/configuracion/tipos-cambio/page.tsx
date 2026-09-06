import { notFound } from "next/navigation";
import {
  listarMonedasDeEmpresa,
  listarTiposCambioDeEmpresaMes,
  obtenerEmpresa,
} from "@erp/db";
import { TiposCambioGrid } from "@/components/panel/tipos-cambio-grid";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function TiposCambioPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const { empresaId } = await params;
  const sp = await searchParams;

  const hoy = new Date();
  const anio = Number(sp.anio) || hoy.getFullYear();
  const mesRaw = Number(sp.mes) || hoy.getMonth() + 1;
  const mes = mesRaw >= 1 && mesRaw <= 12 ? mesRaw : hoy.getMonth() + 1;

  const [empresa, monedas, valores] = await Promise.all([
    obtenerEmpresa(empresaId),
    listarMonedasDeEmpresa(empresaId),
    listarTiposCambioDeEmpresaMes(empresaId, anio, mes),
  ]);
  if (!empresa) notFound();

  const columnas = monedas
    .filter((m) => m.id !== empresa.monedaFuncionalId)
    .map((m) => ({ id: m.id, codigo: m.codigo, nombre: m.nombre }));

  return (
    <>
      <TypographyHeading
        title="Tipos de cambio"
        description="Valor diario de cada moneda de la empresa (3.9). La moneda funcional no se cotiza contra sí misma."
      />
      <TiposCambioGrid
        empresaId={empresaId}
        anio={anio}
        mes={mes}
        monedas={columnas}
        formato={{
          separadorDecimal: empresa.separadorDecimal,
          separadorMiles: empresa.separadorMiles,
        }}
        decimales={empresa.decimalesTipoCambio}
        valores={valores.map((v) => ({
          monedaId: v.monedaId,
          fecha: v.fecha,
          valorEnClp: v.valorEnClp,
        }))}
      />
    </>
  );
}
