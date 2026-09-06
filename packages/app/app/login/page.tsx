import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth-helpers";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage() {
  const session = await obtenerSesion();
  if (session?.user) redirect("/admin/empresas");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ERP Contable</CardTitle>
          <p className="text-sm text-muted-foreground">Ingresa con tu email y contraseña.</p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
