"use client";

import { Suspense, useEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  getTreeCollapsed,
  getTreeCollapsedServer,
  subscribePanelPrefs,
  toggleTreeCollapsed,
} from "@/components/panel/panel-prefs";
import {
  evaluarModo,
  modoEmbebido,
  modoServidor,
  modoWorkspace,
  suscribirModo,
} from "@/components/panel/workspace";
import { useGuardiaDeEnlaces } from "@/components/panel/cambios-sin-guardar";
import { WorkspaceBridge } from "@/components/panel/workspace-bridge";
import { WorkspaceTabs } from "@/components/panel/workspace-tabs";

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
  empresaId,
  menuBar,
  sidebar,
  mobileTopBar,
  mobileTabBar,
  contextoFirma,
  children,
}: {
  empresaId: string;
  menuBar: ReactNode;
  sidebar: ReactNode;
  mobileTopBar: ReactNode;
  mobileTabBar: ReactNode;
  contextoFirma?: ReactNode;
  children: ReactNode;
}) {
  const { treeCollapsed } = usePanelShell();
  // Pestañas (ver components/panel/workspace.ts): la ventana principal de escritorio muestra la
  // barra de pestañas en lugar de la página; dentro de una pestaña no se dibuja el cromo.
  const workspace = useSyncExternalStore(suscribirModo, modoWorkspace, modoServidor);
  const embebido = useSyncExternalStore(suscribirModo, modoEmbebido, modoServidor);
  useEffect(evaluarModo, []);
  useGuardiaDeEnlaces();

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      {/* Cromo de escritorio (`lg` en adelante) — header */}
      <div data-cromo className="hidden lg:block lg:shrink-0">
        {!embebido && menuBar}
      </div>

      {/* Cromo mobile (`<lg`) — barra superior compacta, sin árbol lateral */}
      <div data-cromo className="lg:hidden">
        {!embebido && mobileTopBar}
      </div>

      {contextoFirma}

      {/* Cuerpo: árbol (solo escritorio) + área de trabajo */}
      <div className="flex min-h-0 flex-1">
        <aside
          data-cromo
          className={
            "hidden shrink-0 overflow-y-auto border-r border-border bg-gray-50 transition-[width] duration-150 lg:block " +
            (treeCollapsed ? "w-0 border-r-0" : "w-64")
          }
        >
          {!embebido && !treeCollapsed && sidebar}
        </aside>
        {workspace ? (
          <main className="flex min-w-0 flex-1 flex-col">
            <Suspense fallback={null}>
              <WorkspaceTabs key={empresaId} empresaId={empresaId} />
            </Suspense>
          </main>
        ) : (
          <main data-ws-hijos className="@container min-w-0 flex-1 overflow-auto p-4 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        )}
      </div>

      <div data-cromo className="lg:hidden">
        {!embebido && mobileTabBar}
      </div>
      <Suspense fallback={null}>
        <WorkspaceBridge empresaId={empresaId} />
      </Suspense>
    </div>
  );
}
