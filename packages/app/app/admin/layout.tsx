import { LockIcon } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth-helpers";
import { leerColorScheme } from "@/lib/color-scheme";
import { cn } from "@/lib/utils";
import { AdminNav, type AdminNavItem } from "@/components/admin-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

// Header y contenido comparten literalmente esta clase — así no se pueden desalinear.
const CONTENEDOR = "mx-auto w-full max-w-7xl px-8";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, scheme] = await Promise.all([obtenerSesion(), leerColorScheme()]);
  if (!session?.user) redirect("/login");

  const nav: AdminNavItem[] = [
    { href: "/admin/empresas", label: "Empresas cliente" },
    ...(session.user.esAdminFirma
      ? [
          { href: "/admin/firmas", label: "Mi firma" },
          { href: "/admin/usuarios", label: "Usuarios" },
        ]
      : []),
    ...(session.user.esSuperAdmin
      ? [{ href: "/superadmin/firmas", label: "Firmas", icon: <LockIcon className="size-3.5" /> }]
      : []),
  ];

  // El rol más alto: superadmin > admin de firma > (rol por empresa, no aplica acá).
  const rolLabel = session.user.esSuperAdmin ? "Superadmin" : session.user.esAdminFirma ? "Admin" : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F9FA]">
      <header className="sticky top-0 z-10 w-full shrink-0 border-b border-border bg-white">
        <div className={cn(CONTENEDOR, "flex h-16 items-center justify-between gap-6")}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2">
              <Image src="/login.png" alt="Tessora ERP" width={28} height={28} />
              <p className="font-heading text-sm font-semibold">Tessora ERP</p>
            </div>
            <span className="h-6 w-px bg-border" />
            <AdminNav items={nav} />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle
              scheme={scheme}
              className="size-9 text-muted-foreground hover:bg-muted hover:text-foreground"
            />
            <UserMenu userName={session.user.name ?? "—"} rolLabel={rolLabel} />
          </div>
        </div>
      </header>
      <main className={cn(CONTENEDOR, "@container flex flex-1 flex-col gap-4 py-8 min-w-0")}>
        {children}
      </main>
    </div>
  );
}
