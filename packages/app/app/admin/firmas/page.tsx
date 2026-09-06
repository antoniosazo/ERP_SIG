import { redirect } from "next/navigation";
import { obtenerFirmaContable } from "@erp/db";
import { obtenerSesion } from "@/lib/auth-helpers";
import { EditarFirmaForm } from "@/components/editar-firma-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function MiFirmaPage() {
  const session = await obtenerSesion();
  if (!session?.user.esAdminFirma) redirect("/admin/empresas");

  const firma = await obtenerFirmaContable(session.user.firmaContableId);
  if (!firma) redirect("/admin/empresas");

  return (
    <>
      <TypographyHeading
        title="Mi firma"
        description="Datos de la firma contable (3.0 del diseño técnico). El RUT no es editable."
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {firma.razonSocial} <span className="text-muted-foreground">— {firma.rut}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditarFirmaForm
            valoresIniciales={{
              razonSocial: firma.razonSocial,
              planContratado: firma.planContratado,
              estado: firma.estado,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
