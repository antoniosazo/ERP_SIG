import { redirect } from "next/navigation";
import { listarFirmasContables } from "@erp/db";
import { obtenerSesion } from "@/lib/auth-helpers";
import { CrearFirmaForm } from "@/components/crear-firma-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function SuperAdminFirmasPage() {
  const session = await obtenerSesion();
  if (!session?.user.esSuperAdmin) redirect("/admin/empresas");

  const firmas = await listarFirmasContables();

  return (
    <>
      <TypographyHeading
        title="Firmas contables"
        description="Alta de firmas nuevas y su primer Administrador. Visible solo para superadmin del sistema."
      />

      <Card>
        <CardHeader>
          <CardTitle>Nueva firma</CardTitle>
        </CardHeader>
        <CardContent>
          <CrearFirmaForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firmas ({firmas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razón social</TableHead>
                  <TableHead>RUT</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firmas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.razonSocial}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{f.rut}</TableCell>
                    <TableCell>{f.planContratado}</TableCell>
                    <TableCell>
                      <Badge variant={f.estado === "Activa" ? "default" : "secondary"}>{f.estado}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
