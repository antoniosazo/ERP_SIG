"use client";

import Image from "next/image";
import { PanelLeftIcon } from "lucide-react";
import { usePanelShell } from "@/components/panel/panel-shell";
import { EmpresaSwitcher, type EmpresaOpcion } from "@/components/panel/empresa-switcher";
import { GlobalSearch } from "@/components/panel/global-search";
import type { ColorScheme } from "@/lib/color-scheme";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

/** Header de escritorio del panel por empresa — reemplaza a la barra de menú tipo escritorio. */
export function PanelHeader({
  empresaId,
  empresas,
  empresaActual,
  periodoLabel,
  periodoAbierto,
  monedaFuncional,
  userName,
  rolLabel,
  scheme,
}: {
  empresaId: string;
  empresas: EmpresaOpcion[];
  empresaActual: EmpresaOpcion;
  periodoLabel: string | null;
  periodoAbierto: boolean;
  monedaFuncional: string | null;
  userName: string;
  rolLabel: string | null;
  scheme: ColorScheme;
}) {
  const { toggleTree } = usePanelShell();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-white px-4">
      <button
        type="button"
        onClick={toggleTree}
        title="Alternar árbol de navegación"
        aria-label="Alternar árbol de navegación"
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <PanelLeftIcon className="size-4" />
      </button>
      <Image src="/login.png" alt="Tessora ERP" width={28} height={28} className="shrink-0" />
      <EmpresaSwitcher empresas={empresas} actual={empresaActual} />

      {periodoLabel && (
        <div className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground sm:flex">
          <span
            className={`size-1.5 shrink-0 rounded-full ${periodoAbierto ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
          />
          {periodoLabel}
        </div>
      )}
      {monedaFuncional && (
        <span className="hidden text-xs text-muted-foreground sm:inline">{monedaFuncional}</span>
      )}

      <span className="flex-1" />

      <GlobalSearch empresaId={empresaId} />
      <ThemeToggle scheme={scheme} className="size-9 text-muted-foreground hover:bg-muted hover:text-foreground" />
      <UserMenu userName={userName} rolLabel={rolLabel} />
    </header>
  );
}
