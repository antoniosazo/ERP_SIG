import { notFound } from "next/navigation";
import { empresaTieneAsientos, listarMonedasDeEmpresa, obtenerEmpresa } from "@erp/db";
import { EmpresaEditForm } from "@/components/panel/empresa-edit-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function DetallesEmpresaPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [empresa, monedas, tieneAsientos] = await Promise.all([
    obtenerEmpresa(empresaId),
    listarMonedasDeEmpresa(empresaId),
    empresaTieneAsientos(empresaId),
  ]);
  if (!empresa) notFound();

  return (
    <>
      <TypographyHeading
        title="Detalles de la empresa"
        description="Ficha equivalente a «Detalles de la sociedad» (Módulo 4.9-A). El RUT y la plantilla de plan de cuentas no se editan aquí."
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {empresa.razonSocial} <span className="text-muted-foreground">— {empresa.rut}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmpresaEditForm
            empresaId={empresaId}
            monedaFuncionalBloqueada={tieneAsientos}
            monedas={monedas.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }))}
            valoresIniciales={{
              razonSocial: empresa.razonSocial,
              giro: empresa.giro,
              direccion: empresa.direccion ?? undefined,
              regimenTributario: empresa.regimenTributario,
              fechaInicioActividades: empresa.fechaInicioActividades ?? "",
              monedaFuncionalId: empresa.monedaFuncionalId,
              monedaReporteId: empresa.monedaReporteId ?? undefined,
              permiteMultimoneda: empresa.permiteMultimoneda,
              aplicaIfrs: empresa.aplicaIfrs,
              estado: empresa.estado,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
