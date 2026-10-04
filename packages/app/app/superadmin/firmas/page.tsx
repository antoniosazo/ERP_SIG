import { redirect } from "next/navigation";
import { listarFirmasContables } from "@erp/db";
import { obtenerSesion } from "@/lib/auth-helpers";
import { FirmasAdminView } from "@/components/firmas-admin-view";

export const dynamic = "force-dynamic";
// El alta crea un proyecto Neon y espera a que acepte conexiones: puede tardar más de un minuto.
export const maxDuration = 300;

export default async function SuperAdminFirmasPage() {
  const session = await obtenerSesion();
  if (!session?.user.esSuperAdmin) redirect("/admin/empresas");

  const firmas = await listarFirmasContables();

  return (
    <FirmasAdminView
      firmas={firmas.map((f) => ({
        id: f.id,
        rut: f.rut,
        razonSocial: f.razonSocial,
        planContratado: f.planContratado,
        estado: f.estado,
        proveedor: f.proveedor,
        neonProyectoId: f.neonProyectoId,
        region: f.region,
        estadoBase: f.estadoBase,
        versionEsquema: f.versionEsquema,
        errorMigracion: f.errorMigracion,
      }))}
    />
  );
}
