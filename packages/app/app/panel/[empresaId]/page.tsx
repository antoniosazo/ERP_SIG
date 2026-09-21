import Link from "next/link";
import {
  listarCategorias,
  listarCentrosCosto,
  listarPlanCuentasDeEmpresa,
  listarTerceros,
  obtenerEmpresa,
} from "@erp/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function ResumenEmpresaPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [empresa, cuentas, centros, categorias, terceros] = await Promise.all([
    obtenerEmpresa(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
    listarCentrosCosto(empresaId),
    listarCategorias(empresaId),
    listarTerceros(empresaId),
  ]);

  const cuentasImputables = cuentas.filter((c) => c.nivelImputable && c.activa).length;

  const stats = [
    { label: "Cuentas del plan", valor: cuentas.length, detalle: `${cuentasImputables} imputables activas` },
    { label: "Centros de costo", valor: centros.length, detalle: "dimensión de análisis" },
    { label: "Categorías contables", valor: categorias.length, detalle: "determinación de cuentas" },
    { label: "Terceros", valor: terceros.length, detalle: "clientes / proveedores" },
  ];

  return (
    <>
      <TypographyHeading
        title="Resumen"
        description="Estado de la configuración de esta empresa."
      />

      <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{s.valor}</p>
              <p className="text-xs text-muted-foreground">{s.detalle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm @xl:grid-cols-2">
          <Dato label="Giro" valor={empresa?.giro ?? "—"} />
          <Dato label="Régimen tributario" valor={empresa?.regimenTributario ?? "—"} />
          <Dato
            label="Primer periodo contable"
            valor={
              empresa
                ? `${MESES[Number(empresa.fechaPrimerPeriodoContable.slice(5, 7)) - 1]} ${empresa.fechaPrimerPeriodoContable.slice(0, 4)}`
                : "—"
            }
          />
          <Dato label="Multi-moneda" valor={empresa?.permiteMultimoneda ? "Sí" : "No"} />
          <Dato label="Aplica IFRS" valor={empresa?.aplicaIfrs ? "Sí" : "No"} />
          <Dato label="Estado" valor={empresa?.estado ?? "—"} />
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Ajusta la parametrización desde{" "}
        <Link
          href={`/panel/${empresaId}/configuracion/empresa`}
          className="text-primary underline-offset-4 hover:underline"
        >
          Administración
        </Link>
        .
      </p>
    </>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{valor}</span>
    </div>
  );
}
