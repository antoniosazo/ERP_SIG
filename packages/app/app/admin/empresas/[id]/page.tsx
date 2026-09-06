import Link from "next/link";
import { notFound } from "next/navigation";
import { obtenerEmpresaConDetalle } from "@erp/db";
import { PERIODO_ESTADOS_ABIERTOS } from "@erp/shared";
import { obtenerSesion } from "@/lib/auth-helpers";
import { PlanCuentasTree } from "@/components/plan-cuentas-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default async function EmpresaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await obtenerSesion();
  if (!session?.user) notFound();

  const detalle = await obtenerEmpresaConDetalle(id);
  if (!detalle) notFound();

  const { empresa, cuentas, periodos } = detalle;

  const tieneAcceso =
    session.user.esAdminFirma ||
    (empresa.firmaContableId === session.user.firmaContableId &&
      session.user.empresas.some((a) => a.empresaId === empresa.id));
  if (!tieneAcceso) notFound();

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <TypographyHeading
          title={empresa.razonSocial}
          description={`${empresa.rut} — ${empresa.giro}`}
        />
        <div className="flex items-center gap-2">
          {empresa.aplicaIfrs && <Badge>IFRS</Badge>}
          <Badge variant={empresa.estado === "Activa" ? "default" : "secondary"}>
            {empresa.estado}
          </Badge>
          <Button asChild size="sm">
            <Link href={`/panel/${empresa.id}`}>Abrir entorno de la empresa</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos de inicialización (4.9-A)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Dato label="Régimen tributario" valor={empresa.regimenTributario} />
            <Dato
              label="Fecha inicio actividades"
              valor={empresa.fechaInicioActividades ?? "—"}
            />
            <Dato label="Admite multi-moneda" valor={empresa.permiteMultimoneda ? "Sí" : "No"} />
            <Dato label="Aplica IFRS" valor={empresa.aplicaIfrs ? "Sí" : "No"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Periodos contables (3.12)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {periodos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin periodos abiertos.</p>
            ) : (
              periodos.map((periodo) => (
                <div key={periodo.id} className="flex items-center justify-between text-sm">
                  <span>
                    {MESES[periodo.mes - 1]} {periodo.anio}
                  </span>
                  <Badge
                    variant={
                      (PERIODO_ESTADOS_ABIERTOS as readonly string[]).includes(periodo.estado)
                        ? "default"
                        : "secondary"
                    }
                  >
                    {periodo.estado}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan de cuentas clonado ({cuentas.length} cuentas)</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanCuentasTree cuentas={cuentas} />
        </CardContent>
      </Card>
    </>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{valor}</span>
    </div>
  );
}
