"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { GRUPOS, RESUMEN } from "@/components/panel/panel-nav";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Destino = { label: string; href: string; grupo: string };

/** Buscador global (⌘K) — paleta de comandos para saltar a cualquier sección del panel. */
export function GlobalSearch({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [atajo, setAtajo] = useState("⌘K");

  useEffect(() => {
    const esMac = navigator.platform.toLowerCase().includes("mac");
    setAtajo(esMac ? "⌘K" : "Ctrl K");
  }, []);

  const destinos = useMemo<Destino[]>(() => {
    const todos: Destino[] = [{ label: RESUMEN.label, href: RESUMEN.href, grupo: "" }];
    for (const grupo of GRUPOS) {
      for (const item of grupo.items ?? []) {
        todos.push({ label: item.label, href: item.href, grupo: grupo.label });
      }
      for (const sub of grupo.subgrupos ?? []) {
        for (const item of sub.items) {
          todos.push({ label: item.label, href: item.href, grupo: `${grupo.label} · ${sub.label}` });
        }
      }
    }
    return todos;
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!abierto) setQuery("");
  }, [abierto]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const resultado = q ? destinos.filter((d) => d.label.toLowerCase().includes(q)) : destinos;
    return resultado.slice(0, 8);
  }, [destinos, query]);

  function ir(href: string) {
    setAbierto(false);
    router.push(`/panel/${empresaId}${href}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-9 w-72 items-center gap-2 rounded-lg border border-input px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {atajo}
        </kbd>
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-md gap-0 p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ir a una sección…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              Esc
            </kbd>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {filtrados.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Sin resultados</p>
            ) : (
              filtrados.map((d) => (
                <button
                  key={d.href}
                  type="button"
                  onClick={() => ir(d.href)}
                  className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span>{d.label}</span>
                  {d.grupo && <span className="text-xs text-muted-foreground">{d.grupo}</span>}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
