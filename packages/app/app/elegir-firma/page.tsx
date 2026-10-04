import Image from "next/image";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth-helpers";
import { rutaInicial } from "@/lib/inicio";
import { ElegirFirmaLista } from "@/components/elegir-firma-lista";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

/** Quien pertenece a varias firmas elige con cuál trabajar. Con una sola entra directo. */
export default async function ElegirFirmaPage() {
  const session = await obtenerSesion();
  if (!session?.user) redirect("/login");
  // El superadmin elige en Firmas; quien ya tiene firma activa no pasa por aquí.
  if (session.user.esSuperAdmin || session.user.firmaContableId) redirect(rutaInicial(session.user));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/login.png" alt="Tessora ERP" width={64} height={64} priority />
          <div>
            <h1 className="text-xl font-semibold">¿Con qué firma vas a trabajar?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu cuenta tiene acceso a más de una firma. Puedes cambiar de firma cuando quieras desde el menú de arriba.
            </p>
          </div>
        </div>
        {session.user.firmas.length === 0 ? (
          <p className="rounded-md border p-4 text-center text-sm text-muted-foreground">Tu cuenta no tiene firmas vigentes. Pide a tu administrador que revise tu acceso.</p>
        ) : (
          <ElegirFirmaLista firmas={session.user.firmas} />
        )}
        <div className="flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
