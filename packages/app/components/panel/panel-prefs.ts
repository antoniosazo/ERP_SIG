"use client";

/**
 * Preferencias del cromo del panel (colapso del árbol, grupos expandidos) en
 * `localStorage`, expuestas como stores para `useSyncExternalStore` — así se evita
 * `setState` dentro de effects y los problemas de hidratación.
 */

const TREE_COLLAPSED = "erp-tree-collapsed";
const TREE_GROUPS = "erp-tree";

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function subscribePanelPrefs(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// ── Árbol colapsado (booleano) — colapsado por defecto al entrar a una empresa ──
export function getTreeCollapsed(): boolean {
  try {
    const raw = localStorage.getItem(TREE_COLLAPSED);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}
export function getTreeCollapsedServer(): boolean {
  return true;
}
export function setTreeCollapsed(v: boolean) {
  try {
    localStorage.setItem(TREE_COLLAPSED, v ? "1" : "0");
  } catch {
    /* noop */
  }
  emit();
}
export function toggleTreeCollapsed() {
  setTreeCollapsed(!getTreeCollapsed());
}

// ── Grupos expandidos del árbol (mapa) ──────────────────────────────────────
export const GRUPOS_DEFAULT: Readonly<Record<string, boolean>> = Object.freeze({
  Configuración: false,
  "Socios de Negocio": true,
  Inventario: true,
  Ventas: true,
  Compras: true,
});

let gruposCache: Record<string, boolean> = { ...GRUPOS_DEFAULT };
let gruposRaw: string | null = null;

function leerGrupos(): Record<string, boolean> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TREE_GROUPS);
  } catch {
    raw = null;
  }
  if (raw === gruposRaw) return gruposCache;
  gruposRaw = raw;
  if (raw) {
    try {
      gruposCache = { ...GRUPOS_DEFAULT, ...(JSON.parse(raw) as Record<string, boolean>) };
    } catch {
      gruposCache = { ...GRUPOS_DEFAULT };
    }
  } else {
    gruposCache = { ...GRUPOS_DEFAULT };
  }
  return gruposCache;
}

export function getGrupos(): Record<string, boolean> {
  return leerGrupos();
}
export function getGruposServer(): Record<string, boolean> {
  return GRUPOS_DEFAULT as Record<string, boolean>;
}
export function setGrupo(label: string, open: boolean) {
  const next = { ...leerGrupos(), [label]: open };
  try {
    localStorage.setItem(TREE_GROUPS, JSON.stringify(next));
  } catch {
    /* noop */
  }
  gruposRaw = null; // fuerza relectura en el próximo getGrupos
  emit();
}
