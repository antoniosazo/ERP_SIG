"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { PanelLeftIcon, SearchIcon } from "lucide-react";
import {
  getTreeCollapsed,
  getTreeCollapsedServer,
  subscribePanelPrefs,
  toggleTreeCollapsed,
} from "@/components/panel/panel-prefs";

/** Estado del cromo del panel — el sidebar y la barra de menú lo leen de `panel-prefs`. */
export function usePanelShell() {
  const treeCollapsed = useSyncExternalStore(
    subscribePanelPrefs,
    getTreeCollapsed,
    getTreeCollapsedServer,
  );
  return { treeCollapsed, toggleTree: toggleTreeCollapsed };
}

export function PanelShell({
  menuBar,
  sidebar,
  statusBar,
  children,
}: {
  menuBar: ReactNode;
  sidebar: ReactNode;
  statusBar: ReactNode;
  children: ReactNode;
}) {
  const { treeCollapsed, toggleTree } = usePanelShell();

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      {menuBar}

      {/* Barra de iconos */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-toolbar-border bg-toolbar px-2">
        <button
          type="button"
          onClick={toggleTree}
          title={treeCollapsed ? "Mostrar árbol" : "Ocultar árbol"}
          aria-label="Alternar árbol de navegación"
          className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <PanelLeftIcon className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-toolbar-border" />
        <button
          type="button"
          disabled
          title="Buscar (próximamente)"
          className="flex size-7 items-center justify-center rounded-sm text-muted-foreground/60"
        >
          <SearchIcon className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-toolbar-border" />
        <div id="app-toolbar-actions" className="flex flex-1 items-center gap-1" />
      </div>

      {/* Cuerpo: árbol + área de trabajo */}
      <div className="flex min-h-0 flex-1">
        <aside
          className={
            "shrink-0 overflow-y-auto border-r border-border bg-tree transition-[width] duration-150 " +
            (treeCollapsed ? "w-0 border-r-0" : "w-60")
          }
        >
          {!treeCollapsed && sidebar}
        </aside>
        <main className="@container min-w-0 flex-1 overflow-auto p-4">{children}</main>
      </div>

      {statusBar}
    </div>
  );
}
