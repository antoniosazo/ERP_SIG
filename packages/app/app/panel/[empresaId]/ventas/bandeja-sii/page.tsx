import { listarDtesBandeja, obtenerCredencialesSii } from "@erp/db";
import { BandejaSii, type FilaBandeja } from "@/components/panel/bandeja-sii";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const ESTADOS = ["pendiente", "cargado", "descartado"] as const;

function datosDte(datos: unknown): Pick<
  FilaBandeja,
  "rutEmisor" | "razonSocialEmisor" | "rutReceptor" | "razonSocialReceptor" | "lineas" | "referencias"
> {
  const d = datos as Partial<Pick<FilaBandeja, "rutEmisor" | "razonSocialEmisor" | "rutReceptor" | "razonSocialReceptor" | "lineas" | "referencias">>;
  return {
    rutEmisor: d.rutEmisor ?? "",
    razonSocialEmisor: d.razonSocialEmisor ?? "",
    rutReceptor: d.rutReceptor ?? "",
    razonSocialReceptor: d.razonSocialReceptor ?? "",
    lineas: d.lineas ?? [],
    referencias: d.referencias ?? [],
  };
}

export default async function BandejaSiiPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { empresaId } = await params;
  const { estado: estadoParam } = await searchParams;
  const estado = ESTADOS.find((e) => e === estadoParam) ?? "pendiente";
  const [rows, cred] = await Promise.all([
    listarDtesBandeja(empresaId, "venta", estado),
    obtenerCredencialesSii(empresaId),
  ]);
  const filas: FilaBandeja[] = rows.map((r) => ({
    id: r.id,
    tipoDte: r.tipoDte,
    folio: r.folio,
    rutContraparte: r.rutContraparte,
    razonSocial: r.razonSocialContraparte,
    fechaEmision: r.fechaEmision,
    montoNeto: Number(r.montoNeto),
    montoExento: Number(r.montoExento),
    montoIva: Number(r.montoIva),
    montoTotal: Number(r.montoTotal),
    error: r.error,
    ...datosDte(r.datos),
  }));
  return (
    <>
      <TypographyHeading
        title="Bandeja SII — Ventas"
        description="XML descargados del SII pendientes de validar antes de cargarlos como documento."
      />
      <BandejaSii
        empresaId={empresaId}
        origen="venta"
        estado={estado}
        filas={filas}
        ultimaDescargaEn={cred?.xmlUltimaDescargaEn?.toISOString() ?? null}
        ultimaDescargaDetalle={cred?.xmlUltimaDescargaDetalle ?? null}
      />
    </>
  );
}
