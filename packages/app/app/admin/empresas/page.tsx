import Link from "next/link";
import { redirect } from "next/navigation";
import { listarEmpresasDeFirma } from "@erp/db";
import { obtenerSesion } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const session = await obtenerSesion();
  if (!session?.user) redirect("/login");

  const todasLasEmpresas = await listarEmpresasDeFirma(session.user.firmaContableId);

  // Administrador de la firma ve toda la cartera; el resto solo las empresas que tiene asignadas.
  const empresas = session.user.esAdminFirma
    ? todasLasEmpresas
    : todasLasEmpresas.filter((e) =>
        session.user.empresas.some((asignacion) => asignacion.empresaId === e.id),
      );

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <TypographyHeading
          title="Empresas cliente"
          description="Cada empresa se inicializa clonando un plan de cuentas y abriendo su primer periodo (Proceso 0)."
        />
        {session.user.esAdminFirma && (
          <Button asChild>
            <Link href="/admin/empresas/nueva">Nueva empresa</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresas registradas ({empresas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {empresas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {session.user.esAdminFirma
                ? "Aún no hay empresas cliente creadas."
                : "No tienes empresas asignadas todavía. Pídele a tu Administrador que te asigne una."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RUT</TableHead>
                  <TableHead>Razón social</TableHead>
                  <TableHead>IFRS</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((empresa) => (
                  <TableRow key={empresa.id}>
                    <TableCell>{empresa.rut}</TableCell>
                    <TableCell>
                      <Link href={`/panel/${empresa.id}`} className="hover:underline">
                        {empresa.razonSocial}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {empresa.aplicaIfrs ? (
                        <Badge>Sí</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={empresa.estado === "Activa" ? "default" : "secondary"}>
                        {empresa.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
