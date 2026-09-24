"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  getTreeCollapsed,
  getTreeCollapsedServer,
  subscribePanelPrefs,
  toggleTreeCollapsed,
} from "@/components/panel/panel-prefs";

/** Estado del cromo del panel — el sidebar y el header lo leen de `panel-prefs`. */
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
  mobileTopBar,
  mobileTabBar,
  children,
}: {
  menuBar: ReactNode;
  sidebar: ReactNode;
  mobileTopBar: ReactNode;
  mobileTabBar: ReactNode;
  children: ReactNode;
}) {
  const { treeCollapsed } = usePanelShell();

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      {/* Cromo de escritorio (`lg` en adelante) — header */}
      <div className="hidden lg:block lg:shrink-0">{menuBar}</div>

      {/* Cromo mobile (`<lg`) — barra superior compacta, sin árbol lateral */}
      <div className="lg:hidden">{mobileTopBar}</div>

      {/* Cuerpo: árbol (solo escritorio) + área de trabajo */}
      <div className="flex min-h-0 flex-1">
        <aside
          className={
            "hidden shrink-0 overflow-y-auto border-r border-border bg-gray-50 transition-[width] duration-150 lg:block " +
            (treeCollapsed ? "w-0 border-r-0" : "w-64")
          }
        >
          {!treeCollapsed && sidebar}
        </aside>
        <main className="@container min-w-0 flex-1 overflow-auto p-4 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      <div className="lg:hidden">{mobileTabBar}</div>
    </div>
  );
}
