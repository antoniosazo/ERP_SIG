import { redirect } from "next/navigation";
import { listarEmpresas, obtenerFirmaContable } from "@erp/db";
import Link from "next/link";
import { obtenerSesionDeFirma } from "@/lib/auth-helpers";
import { EditarFirmaForm } from "@/components/editar-firma-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function MiFirmaPage() {
  const session = await obtenerSesionDeFirma();
  if (!session?.user.esAdminFirma) redirect("/admin/empresas");

  const [firma, empresas] = await Promise.all([obtenerFirmaContable(session.user.firmaContableId), listarEmpresas()]);
  if (!firma) redirect("/admin/empresas");

  return (
    <>
      <TypographyHeading
        title={session.user.firmaVistaNombre ? `Firma: ${firma.razonSocial}` : "Mi firma"}
        description={session.user.firmaVistaNombre
          ? "Estás administrando esta firma con tu cuenta de superadmin. Sus acciones quedan registradas a tu nombre."
          : "Consulta los datos de tu firma y actualiza su razón social. El plan y el estado los administra el superadmin."}
      />

      <Card>
        <CardHeader>
          <CardTitle>Empresas cliente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {empresas.length === 0
              ? "Todavía no hay empresas en esta firma."
              : `${empresas.length} ${empresas.length === 1 ? "empresa en cartera" : "empresas en cartera"}.`}
          </p>
          <Button asChild>
            <Link href="/admin/empresas">{empresas.length === 0 ? "Crear la primera empresa" : "Ver empresas cliente"}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {firma.razonSocial} <span className="text-muted-foreground">— {firma.rut}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Plan: {firma.planContratado} · Estado: {firma.estado}
          </p>
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
