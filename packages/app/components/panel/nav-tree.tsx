"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible } from "radix-ui";
import {
  getGrupos,
  getGruposServer,
  setGrupo,
  subscribePanelPrefs,
} from "@/components/panel/panel-prefs";
import { ChevronRightIcon } from "lucide-react";
import { GRUPOS, RESUMEN, type Item } from "@/components/panel/panel-nav";
import { cn } from "@/lib/utils";

/**
 * Árbol de navegación del entorno por empresa — la única fuente de la lista de
 * opciones, compartida por `PanelSidebar` (escritorio) y `MobileNavDrawer` (celular/
 * tablet). El estado de expansión (`panel-prefs`) también se comparte entre ambos.
 */
export function NavTree({ empresaId, onNavigate }: { empresaId: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const base = `/panel/${empresaId}`;
  const abierto = useSyncExternalStore(subscribePanelPrefs, getGrupos, getGruposServer);

  function esActivo(item: Item) {
    const href = `${base}${item.href}`;
    return item.exact ? pathname === href : pathname.startsWith(href);
  }

  const linkCls = (activo: boolean) =>
    cn(
      "flex items-center gap-2 rounded-md border-l-2 py-1.5 pr-2.5 pl-2 text-sm whitespace-nowrap transition-colors",
      activo
        ? "border-teal-500 bg-teal-50 font-medium text-teal-700"
        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const renderItem = (item: Item) => {
    const activo = esActivo(item);
    const Icono = item.icon;
    return (
      <Link
        key={item.href}
        href={`${base}${item.href}`}
        aria-current={activo ? "page" : undefined}
        className={linkCls(activo)}
        onClick={onNavigate}
      >
        <Icono className="size-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-0.5">
      {renderItem(RESUMEN)}

      {GRUPOS.map((grupo) => {
        const todos = grupo.items ?? grupo.subgrupos?.flatMap((sg) => sg.items) ?? [];
        const GrupoIcono = grupo.icon;
        // Sin preferencia guardada, un grupo se abre solo si la pantalla actual está dentro.
        const abrirPorDefecto = grupo.subgrupos ? todos.some(esActivo) : true;
        return (
          <Collapsible.Root
            key={grupo.label}
            open={abierto[grupo.label] ?? abrirPorDefecto}
            onOpenChange={(o) => setGrupo(grupo.label, o)}
            className="mt-1"
          >
            <Collapsible.Trigger className="group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <GrupoIcono className="size-4 shrink-0" />
              <span className="flex-1 text-left">{grupo.label}</span>
              <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
            </Collapsible.Trigger>
            <Collapsible.Content className="mt-0.5 flex flex-col gap-0.5 pl-6">
              {grupo.items?.map(renderItem)}
              {grupo.subgrupos?.map((sg) => {
                const clave = `${grupo.label}/${sg.label}`;
                return (
                  <Collapsible.Root
                    key={clave}
                    open={abierto[clave] ?? sg.items.some(esActivo)}
                    onOpenChange={(o) => setGrupo(clave, o)}
                  >
                    <Collapsible.Trigger className="group flex w-full items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                      <span className="flex-1 text-left">{sg.label}</span>
                      <ChevronRightIcon className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                    </Collapsible.Trigger>
                    <Collapsible.Content className="flex flex-col gap-0.5 pl-3">
                      {sg.items.map(renderItem)}
                    </Collapsible.Content>
                  </Collapsible.Root>
                );
              })}
            </Collapsible.Content>
          </Collapsible.Root>
        );
      })}
    </nav>
  );
}
