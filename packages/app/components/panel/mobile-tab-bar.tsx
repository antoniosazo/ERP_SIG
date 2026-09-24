"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CoinsIcon, FileTextIcon, LayoutDashboardIcon, MenuIcon, PackageIcon } from "lucide-react";
import { NavTree } from "@/components/panel/nav-tree";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const OTROS_PREFIJOS = ["/maestros", "/inventario", "/informes", "/configuracion"];

/**
 * Navegación inferior para celular/tablet (`<lg`) — los 4 destinos de uso diario más
 * "Más", que abre el árbol completo (`NavTree`) en un drawer para el resto de módulos.
 */
export function MobileTabBar({ empresaId, razonSocial }: { empresaId: string; razonSocial: string }) {
  const pathname = usePathname();
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const base = `/panel/${empresaId}`;

  const tabs = [
    { href: base, label: "Resumen", icon: LayoutDashboardIcon, activo: pathname === base },
    {
      href: `${base}/ventas/facturas`,
      label: "Ventas",
      icon: FileTextIcon,
      activo: pathname.startsWith(`${base}/ventas`),
    },
    {
      href: `${base}/compras/facturas`,
      label: "Compras",
      icon: PackageIcon,
      activo: pathname.startsWith(`${base}/compras`),
    },
    {
      href: `${base}/tesoreria/pagos-recibidos`,
      label: "Tesorería",
      icon: CoinsIcon,
      activo: pathname.startsWith(`${base}/tesoreria`),
    },
  ];
  const otrosActivo = OTROS_PREFIJOS.some((p) => pathname.startsWith(`${base}${p}`));

  const itemCls = (activo: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px]",
      activo ? "text-primary" : "text-muted-foreground",
    );

  return (
    <nav className="flex h-16 shrink-0 items-stretch border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={itemCls(t.activo)}>
          <t.icon className="size-5" />
          {t.label}
        </Link>
      ))}
      <Sheet open={drawerAbierto} onOpenChange={setDrawerAbierto}>
        <SheetTrigger className={itemCls(otrosActivo)}>
          <MenuIcon className="size-5" />
          Más
        </SheetTrigger>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{razonSocial}</SheetTitle>
          </SheetHeader>
          <NavTree empresaId={empresaId} onNavigate={() => setDrawerAbierto(false)} />
        </SheetContent>
      </Sheet>
    </nav>
  );
}
