import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth-helpers";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await obtenerSesion();
  if (!session?.user) redirect("/login");

  const nav = [
    { href: "/admin/empresas", label: "Empresas cliente" },
    ...(session.user.esAdminFirma
      ? [
          { href: "/admin/firmas", label: "Mi firma" },
          { href: "/admin/usuarios", label: "Usuarios" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-10 mx-auto mt-0.5 flex h-16 w-full max-w-5xl shrink-0 items-center rounded-3xl bg-background shadow-xs">
        <div className="flex w-full items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-6 min-w-0">
            <span className="font-heading font-semibold">ERP Contable — Configuración</span>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {session.user.name}
              {session.user.esAdminFirma && " · Admin"}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="@container mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-8 min-w-0">
        {children}
      </main>
    </div>
  );
}
