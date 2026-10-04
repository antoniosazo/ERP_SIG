import { LockIcon } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth-helpers";
import { leerColorScheme } from "@/lib/color-scheme";
import { rutaInicial, superadminSinFirma } from "@/lib/inicio";
import { AdminNav, type AdminNavItem } from "@/components/admin-nav";
import { ContextoFirmaBanner } from "@/components/contexto-firma-banner";
import { SelectorFirma } from "@/components/selector-firma";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

/** Marco compartido por la administración de la firma y la plataforma. */
export async function AdminShell({
  children,
  soloSuperAdmin = false,
}: {
  children: React.ReactNode;
  soloSuperAdmin?: boolean;
}) {
  const [session, scheme] = await Promise.all([obtenerSesion(), leerColorScheme()]);
  if (!session?.user) redirect("/login");
  if (soloSuperAdmin && !session.user.esSuperAdmin) redirect("/admin/empresas");
  // Antes de ver empresas, usuarios o datos hay que haber elegido firma: el superadmin en Firmas
  // y quien pertenece a varias en su selector (ver `rutaInicial`).
  if (!soloSuperAdmin && !session.user.firmaContableId) redirect(rutaInicial(session.user));

  const itemFirmas: AdminNavItem = { href: "/superadmin/firmas", label: "Firmas", icon: <LockIcon className="size-3.5" /> };
  // El menú sigue el recorrido: firma primero y, desde ella, sus empresas.
  const nav: AdminNavItem[] = superadminSinFirma(session.user)
    ? [itemFirmas]
    : [
        ...(session.user.esSuperAdmin ? [itemFirmas] : []),
        ...(session.user.esAdminFirma
          ? [{ href: "/admin/firmas", label: session.user.firmaVistaNombre ? "Firma seleccionada" : "Mi firma" }]
          : []),
        { href: "/admin/empresas", label: "Empresas cliente" },
        ...(session.user.esAdminFirma ? [{ href: "/admin/usuarios", label: "Usuarios" }] : []),
      ];
  const rolLabel = session.user.esSuperAdmin ? "Superadmin" : session.user.esAdminFirma ? "Admin" : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image src="/login.png" alt="Tessora ERP" width={30} height={30} />
            <div className="leading-tight">
              <p className="font-heading text-sm font-semibold">Tessora ERP</p>
              <p className="text-[11px] text-muted-foreground">Administración</p>
            </div>
          </div>
          <div className="order-3 w-full overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            <AdminNav items={nav} />
          </div>
          <div className="flex items-center gap-2">
            {session.user.firmas.length > 1 && session.user.firmaContableId && (
              <SelectorFirma firmas={session.user.firmas} actualId={session.user.firmaContableId} actualNombre={session.user.firmaNombre ?? "Firma"} />
            )}
            <ThemeToggle scheme={scheme} className="size-9 text-muted-foreground hover:bg-muted hover:text-foreground" />
            <UserMenu userName={session.user.name ?? "—"} rolLabel={rolLabel} />
          </div>
        </div>
      </header>
      {session.user.firmaVistaNombre && <ContextoFirmaBanner nombre={session.user.firmaVistaNombre} />}
      <main className="@container mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
