import Link from "next/link";
import {
  listarCategorias,
  listarCentrosCosto,
  listarPlanCuentasDeEmpresa,
  listarTerceros,
  obtenerEmpresa,
} from "@erp/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const base = `/panel/${empresaId}`;

  const kpis = [
    {
      label: "Cuentas del plan",
      valor: cuentas.length,
      detalle: `${cuentasImputables} imputables activas`,
      href: `${base}/configuracion/plan-cuentas`,
    },
    {
      label: "Centros de costo",
      valor: centros.length,
      detalle: "dimensión de análisis",
      href: `${base}/configuracion/centros-costo`,
    },
    {
      label: "Categorías contables",
      valor: categorias.length,
      detalle: "reglas de imputación",
      href: `${base}/configuracion/categorias`,
    },
    {
      label: "Terceros",
      valor: terceros.length,
      detalle: "clientes / proveedores",
      href: `${base}/maestros/terceros`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
        <p className="text-sm text-muted-foreground">Estado de la configuración de esta empresa.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="block">
            <Card
              className="h-full cursor-pointer border border-transparent transition hover:border-teal-500"
              style={{ "--card-spacing": "1.25rem" } as React.CSSProperties}
            >
              <CardHeader>
                <CardTitle className="text-sm font-normal text-muted-foreground">{k.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{k.valor}</p>
                <p className="text-xs text-muted-foreground">{k.detalle}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Datos generales</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/configuracion/empresa`}>Editar</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2 @2xl:grid-cols-3">
          <Dato label="Giro" valor={empresa?.giro ?? "—"} />
          <Dato label="Régimen tributario" valor={empresa?.regimenTributario ?? "—"} />
          <Dato
            label="Primer período contable"
            valor={
              empresa
                ? `${MESES[Number(empresa.fechaPrimerPeriodoContable.slice(5, 7)) - 1]} ${empresa.fechaPrimerPeriodoContable.slice(0, 4)}`
                : "—"
            }
          />
          <Dato label="Multi-moneda" valor={empresa?.permiteMultimoneda ? "Sí" : "No"} />
          <Dato label="Aplica IFRS" valor={empresa?.aplicaIfrs ? "Sí" : "No"} />
          <Dato
            label="Estado"
            valor={
              <span className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${empresa?.estado === "Activa" ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
                />
                {empresa?.estado ?? "—"}
              </span>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{valor}</p>
    </div>
  );
}
