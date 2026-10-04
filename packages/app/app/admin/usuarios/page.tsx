import { redirect } from "next/navigation";
import { listarEmpresas, listarUsuariosDeFirma } from "@erp/db";
import { obtenerSesionDeFirma } from "@/lib/auth-helpers";
import { InvitarUsuarioForm } from "@/components/invitar-usuario-form";
import { UsuariosLista, type UsuarioFila } from "@/components/usuarios-lista";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await obtenerSesionDeFirma();
  if (!session?.user.esAdminFirma) redirect("/admin/empresas");

  const [usuarios, empresas] = await Promise.all([
    listarUsuariosDeFirma(session.user.firmaContableId),
    listarEmpresas(),
  ]);
  const opcionesEmpresa = empresas.map((e) => ({ id: e.id, label: e.razonSocial }));
  const filas: UsuarioFila[] = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    estado: u.estado,
    esAdminFirma: u.esAdminFirma,
    esSuperAdmin: u.esSuperAdmin,
    otrasFirmas: u.otrasFirmas,
    asignaciones: u.asignaciones,
    invitacionVencida: u.invitacionVencida,
  }));

  return (
    <>
      <TypographyHeading
        title="Usuarios de la firma"
        description="Invita a contadores, asígnales empresas y roles, y suspende a quien deje de trabajar con la firma. No se envía email: copia el link que se genera y envíaselo tú."
      />

      <Card>
        <CardHeader>
          <CardTitle>Invitar usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <InvitarUsuarioForm empresas={opcionesEmpresa} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios ({filas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <UsuariosLista usuarios={filas} empresas={opcionesEmpresa} yoId={session.user.id} actorEsSuperAdmin={session.user.esSuperAdmin} />
        </CardContent>
      </Card>
    </>
  );
}
