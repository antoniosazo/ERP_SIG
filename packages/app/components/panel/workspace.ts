"use client";

import { GRUPOS, RESUMEN, type Item } from "@/components/panel/panel-nav";

/**
 * Espacio de trabajo con pestañas (estilo SAP B1). En escritorio la ventana principal
 * (`html[data-workspace]`) muestra una barra de pestañas y cada pestaña es un iframe de la
 * misma app en modo embebido (`html[data-embebido]`, sin cromo). Ambos atributos los fija el
 * script inline de `app/layout.tsx` antes de pintar y no cambian durante la vida del documento.
 * Iframe y ventana principal se hablan por `postMessage` con los mensajes de abajo.
 */

/** Pestañas con iframe vivo; sobre este tope la menos usada queda "en reposo" (solo su URL). */
export const MAX_VIVAS = 8;

export type AccionTecla = { tipo: "ir"; n: number } | { tipo: "cerrar" } | { tipo: "mover"; delta: 1 | -1 };

export type MensajeWs =
  | { tipo: "nav"; url: string; titulo: string }
  | { tipo: "abrir"; url: string }
  | { tipo: "salir"; url: string }
  | { tipo: "tecla"; accion: AccionTecla }
  | { tipo: "historial" }
  | { tipo: "buscar" };

// ── Modo del documento ──────────────────────────────────────────────────────
const oyentesModo = new Set<() => void>();
export function suscribirModo(fn: () => void) {
  oyentesModo.add(fn);
  return () => {
    oyentesModo.delete(fn);
  };
}
/**
 * Misma regla que `SCRIPT_MODO` (lib/workspace-script.ts), para cuando se llega al panel con
 * una navegación del cliente (p. ej. desde /admin) y el script inline no volvió a correr.
 */
export function evaluarModo() {
  const d = document.documentElement;
  if (window.top !== window.self || d.hasAttribute("data-workspace")) return;
  const p = window.location.pathname;
  if (/^\/panel\/[^/]+/.test(p) && !esRutaSuelta(p) && window.matchMedia("(min-width: 1024px)").matches) {
    d.setAttribute("data-workspace", "");
    for (const fn of oyentesModo) fn();
  }
}
export function modoEmbebido(): boolean {
  return document.documentElement.hasAttribute("data-embebido");
}
export function modoWorkspace(): boolean {
  return document.documentElement.hasAttribute("data-workspace");
}
export const modoServidor = () => false;

export function enviarAlPadre(m: MensajeWs) {
  window.parent.postMessage(m, window.location.origin);
}

// ── Rutas ───────────────────────────────────────────────────────────────────
/** Vistas que se abren siempre en una ventana aparte del navegador (no como pestaña). */
export function esRutaSuelta(pathname: string): boolean {
  return /\/imprimir\/?$/.test(pathname);
}
export function dentroDeEmpresa(pathname: string, empresaId: string): boolean {
  const base = `/panel/${empresaId}`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

const ITEMS: Item[] = [
  RESUMEN,
  ...GRUPOS.flatMap((g) => [...(g.items ?? []), ...(g.subgrupos?.flatMap((sg) => sg.items) ?? [])]),
];

/** Título a partir del árbol de navegación (la opción más específica que contiene la ruta). */
export function tituloDeRuta(pathname: string, empresaId: string): string {
  const rel = pathname.slice(`/panel/${empresaId}`.length).replace(/\/$/, "");
  let mejor: Item | null = null;
  for (const item of ITEMS) {
    const coincide = item.href === "" ? rel === "" : rel === item.href || rel.startsWith(`${item.href}/`);
    if (coincide && (!mejor || item.href.length > mejor.href.length)) mejor = item;
  }
  if (!mejor) return "Tessora ERP";
  return rel !== mejor.href && rel.endsWith("/nuevo") ? `${mejor.label} · Nuevo` : mejor.label;
}

/** Título de la pantalla actual: su encabezado principal o, si no tiene, el del árbol. */
export function tituloDePagina(empresaId: string): string {
  const h1 = document.querySelector("main h1")?.textContent?.trim();
  return h1 || tituloDeRuta(window.location.pathname, empresaId);
}

/** El `<a>` interno (mismo origen) sobre el que se hizo clic, o null. */
export function enlaceDeClick(e: MouseEvent): { a: HTMLAnchorElement; url: URL } | null {
  if (e.button !== 0 && e.button !== 1) return null;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.hasAttribute("download")) return null;
  const url = new URL(a.href, window.location.href);
  return url.origin === window.location.origin ? { a, url } : null;
}

// ── Atajos ──────────────────────────────────────────────────────────────────
/** Alt+1…9 ir a la pestaña (9 = última), Alt+W cerrar, Alt+←/→ anterior/siguiente. */
export function accionDeTecla(e: KeyboardEvent): AccionTecla | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  if (/^Digit[1-9]$/.test(e.code)) return { tipo: "ir", n: Number(e.code.slice(5)) };
  if (e.code === "KeyW") return { tipo: "cerrar" };
  if (e.code === "ArrowLeft") return { tipo: "mover", delta: -1 };
  if (e.code === "ArrowRight") return { tipo: "mover", delta: 1 };
  return null;
}
export function esAtajoBuscar(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
}

// ── Puentes con el cromo de la ventana principal ────────────────────────────
let abridor: ((url: string) => void) | null = null;
/** Lo registra la barra de pestañas mientras está montada. */
export function registrarAbridor(fn: (url: string) => void) {
  abridor = fn;
  return () => {
    if (abridor === fn) abridor = null;
  };
}
/** Abre `url` en una pestaña nueva si hay espacio de trabajo; false si no lo hay. */
export function abrirPestana(url: string): boolean {
  if (abridor) {
    abridor(url);
    return true;
  }
  if (modoEmbebido()) {
    enviarAlPadre({ tipo: "abrir", url });
    return true;
  }
  return false;
}

const oyentesBuscar = new Set<() => void>();
/** El buscador global se abre en la ventana principal aunque el atajo se pulse en un iframe. */
export function alPedirBuscador(fn: () => void) {
  oyentesBuscar.add(fn);
  return () => {
    oyentesBuscar.delete(fn);
  };
}
export function pedirBuscador() {
  for (const fn of oyentesBuscar) fn();
}

// ── Historial propio de la pestaña (lado embebido) ──────────────────────────
// El historial del navegador es uno solo para todos los iframes: `history.back()` dentro de
// una pestaña podría retroceder otra. "Volver" usa esta pila, que es solo de este iframe.
const pila: string[] = [];
export function registrarVisita(url: string) {
  if (pila.at(-2) === url) pila.pop();
  else if (pila.at(-1) !== url) pila.push(url);
}
export function anteriorDePestana(): string | null {
  return pila.at(-2) ?? null;
}
