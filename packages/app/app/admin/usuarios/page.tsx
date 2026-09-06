import { redirect } from "next/navigation";
import { listarEmpresasDeFirma, listarUsuariosDeFirma } from "@erp/db";
import { obtenerSesion } from "@/lib/auth-helpers";
import { InvitarUsuarioForm } from "@/components/invitar-usuario-form";
import { ResetearPasswordButton } from "@/components/resetear-password-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await obtenerSesion();
  if (!session?.user.esAdminFirma) redirect("/admin/empresas");

  const [usuarios, empresas] = await Promise.all([
    listarUsuariosDeFirma(session.user.firmaContableId),
    listarEmpresasDeFirma(session.user.firmaContableId),
  ]);

  return (
    <>
      <TypographyHeading
        title="Usuarios de la firma"
        description="Alta de contadores por invitación (4.9-E) — sin envío automático de email: copia el link generado y envíalo tú mismo."
      />

      <Card>
        <CardHeader>
          <CardTitle>Invitar contador</CardTitle>
        </CardHeader>
        <CardContent>
          <InvitarUsuarioForm empresas={empresas.map((e) => ({ id: e.id, label: e.razonSocial }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios ({usuarios.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay usuarios invitados.</p>
          ) : (
            usuarios.map((usuario) => (
              <div key={usuario.id} className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {usuario.nombre}{" "}
                      {usuario.esAdminFirma && <Badge className="ml-1">Admin firma</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">{usuario.email}</p>
                  </div>
                  <Badge variant={usuario.estado === "Activo" ? "default" : "secondary"}>
                    {usuario.estado}
                  </Badge>
                </div>
                {usuario.asignaciones.length > 0 && (
                  <ul className="text-sm text-muted-foreground">
                    {usuario.asignaciones.map((a) => (
                      <li key={a.empresaId}>
                        {a.empresaNombre} — {a.rol}
                      </li>
                    ))}
                  </ul>
                )}
                <ResetearPasswordButton usuarioId={usuario.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
