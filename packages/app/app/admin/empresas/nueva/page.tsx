import { redirect } from "next/navigation";
import { listarMonedasPlantilla, listarPlanCuentasPlantillas } from "@erp/db";
import { obtenerSesion } from "@/lib/auth-helpers";
import { EmpresaForm } from "@/components/empresa-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function NuevaEmpresaPage() {
  const session = await obtenerSesion();
  if (!session?.user.esAdminFirma) redirect("/admin/empresas");

  const [monedas, plantillas] = await Promise.all([
    listarMonedasPlantilla(),
    listarPlanCuentasPlantillas(),
  ]);

  return (
    <>
      <TypographyHeading
        title="Nueva empresa cliente"
        description="Asistente de inicialización (módulo 4.9-A) — al guardar se clona el plan de cuentas y se abre el primer periodo contable."
      />

      <Card>
        <CardHeader>
          <CardTitle>Datos de la empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <EmpresaForm
            monedas={monedas.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }))}
            plantillas={plantillas.map((p) => ({ id: p.id, label: p.nombre }))}
          />
        </CardContent>
      </Card>
    </>
  );
}
