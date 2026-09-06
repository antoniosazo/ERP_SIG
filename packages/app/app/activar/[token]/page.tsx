import { obtenerTokenValido } from "@erp/db";
import { ActivarCuentaForm } from "@/components/activar-cuenta-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ActivarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const fila = await obtenerTokenValido(token);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{fila ? "Activar cuenta" : "Link inválido"}</CardTitle>
          {fila ? (
            <p className="text-sm text-muted-foreground">
              Hola {fila.usuarioNombre}, define tu contraseña para activar tu cuenta (
              {fila.usuarioEmail}).
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este link ya fue usado, expiró, o no existe. Pídele a tu Administrador que genere
              uno nuevo desde /admin/usuarios.
            </p>
          )}
        </CardHeader>
        {fila && (
          <CardContent>
            <ActivarCuentaForm token={token} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
