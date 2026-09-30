"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlusIcon, XIcon } from "lucide-react";
import {
  MAX_VIVAS,
  accionDeTecla,
  dentroDeEmpresa,
  enlaceDeClick,
  esRutaSuelta,
  pedirBuscador,
  registrarAbridor,
  tituloDeRuta,
  type AccionTecla,
  type MensajeWs,
} from "@/components/panel/workspace";
import { cn } from "@/lib/utils";

type Pestana = { id: string; n: number; url: string; titulo: string };
type Estado = {
  empresaId: string;
  pestanas: Pestana[]; // orden de la barra
  activa: string;
  vivas: string[]; // ids con iframe montado, la más reciente primero
  siguiente: number; // orden de creación: los iframes se renderizan por `n` para no moverlos en el DOM
};
type Accion =
  | { tipo: "abrir"; url: string }
  | { tipo: "activar"; id: string }
  | { tipo: "cerrar"; id: string }
  | { tipo: "nav"; id: string; url: string; titulo: string }
  | { tipo: "tecla"; accion: AccionTecla };

const clave = (empresaId: string) => `erp-pestanas:${empresaId}`;
const rutaDe = (url: string) => url.split(/[?#]/)[0] ?? url;

function activar(s: Estado, id: string): Estado {
  return { ...s, activa: id, vivas: [id, ...s.vivas.filter((v) => v !== id)].slice(0, MAX_VIVAS) };
}

function reducir(s: Estado, a: Accion): Estado {
  switch (a.tipo) {
    case "abrir": {
      const p: Pestana = {
        id: Math.random().toString(36).slice(2, 10),
        n: s.siguiente,
        url: a.url,
        titulo: tituloDeRuta(rutaDe(a.url), s.empresaId),
      };
      // Como en el navegador: la nueva queda a la derecha de la activa.
      const i = s.pestanas.findIndex((x) => x.id === s.activa);
      const pestanas = i < 0 ? [...s.pestanas, p] : [...s.pestanas.slice(0, i + 1), p, ...s.pestanas.slice(i + 1)];
      return activar({ ...s, pestanas, siguiente: s.siguiente + 1 }, p.id);
    }
    case "activar":
      return s.pestanas.some((p) => p.id === a.id) && s.vivas[0] !== a.id ? activar(s, a.id) : s;
    case "cerrar": {
      const i = s.pestanas.findIndex((p) => p.id === a.id);
      if (i < 0) return s;
      const resto = { ...s, pestanas: s.pestanas.filter((p) => p.id !== a.id), vivas: s.vivas.filter((v) => v !== a.id) };
      if (resto.pestanas.length === 0) return reducir(resto, { tipo: "abrir", url: `/panel/${s.empresaId}` });
      const vecina = resto.pestanas[i] ?? resto.pestanas[i - 1];
      return s.activa !== a.id || !vecina ? resto : activar(resto, vecina.id);
    }
    case "nav": {
      const p = s.pestanas.find((x) => x.id === a.id);
      if (!p || (p.url === a.url && p.titulo === a.titulo)) return s;
      return { ...s, pestanas: s.pestanas.map((x) => (x.id === a.id ? { ...x, url: a.url, titulo: a.titulo } : x)) };
    }
    case "tecla": {
      const { accion } = a;
      if (accion.tipo === "cerrar") return reducir(s, { tipo: "cerrar", id: s.activa });
      const total = s.pestanas.length;
      const destino =
        accion.tipo === "ir"
          ? s.pestanas[accion.n === 9 ? total - 1 : accion.n - 1]
          : s.pestanas[(s.pestanas.findIndex((p) => p.id === s.activa) + accion.delta + total) % total];
      return destino ? reducir(s, { tipo: "activar", id: destino.id }) : s;
    }
  }
}

/**
 * Restaura las pestañas de la empresa guardadas en esta pestaña del navegador. Si la URL de
 * entrada ya es una de ellas (recarga) la activa; si se entra por la raíz de la empresa (cambio
 * de empresa) vuelve a la que estaba activa; si no, abre la URL como pestaña nueva.
 * `actual` viene del router y no de `window.location`: al cambiar de empresa esto corre durante
 * el render, antes de que el router actualice la barra de direcciones.
 */
function estadoInicial({ empresaId, actual }: { empresaId: string; actual: string }): Estado {
  let pestanas: Pestana[] = [];
  let activaGuardada: unknown = null;
  try {
    const g = JSON.parse(sessionStorage.getItem(clave(empresaId)) ?? "null") as {
      pestanas?: Partial<Pestana>[];
      activa?: string;
    } | null;
    pestanas = (g?.pestanas ?? [])
      .filter(
        (p): p is Pestana =>
          typeof p?.id === "string" && typeof p.url === "string" && dentroDeEmpresa(rutaDe(p.url), empresaId),
      )
      .map((p, n) => ({
        id: p.id,
        n,
        url: p.url,
        titulo: typeof p.titulo === "string" ? p.titulo : tituloDeRuta(rutaDe(p.url), empresaId),
      }));
    activaGuardada = g?.activa;
  } catch {
    pestanas = [];
  }
  const s: Estado = { empresaId, pestanas, activa: "", vivas: [], siguiente: pestanas.length };
  const existente =
    pestanas.find((p) => p.url === actual) ??
    (rutaDe(actual) === `/panel/${empresaId}` ? pestanas.find((p) => p.id === activaGuardada) : undefined);
  return existente ? activar(s, existente.id) : reducir(s, { tipo: "abrir", url: actual });
}

/** Espacio de trabajo de escritorio: barra de pestañas + un iframe vivo por pestaña. */
export function WorkspaceTabs({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [s, dispatch] = useReducer(
    reducir,
    { empresaId, actual: pathname + (query ? `?${query}` : "") },
    estadoInicial,
  );
  const marcos = useRef(new Map<string, HTMLIFrameElement>());
  // Siempre hay al menos una pestaña: cerrar la última abre el Resumen.
  const activa = s.pestanas.find((p) => p.id === s.activa) ?? s.pestanas[0]!;

  const abrir = useCallback((url: string) => {
    const u = new URL(url, window.location.href);
    dispatch({ tipo: "abrir", url: u.pathname + u.search + u.hash });
  }, []);

  const registrarMarco = useCallback((id: string, el: HTMLIFrameElement | null) => {
    if (el) marcos.current.set(id, el);
    else marcos.current.delete(id);
  }, []);

  // Persistencia, URL de la ventana (recargar o copiar el enlace lleva a la pestaña activa) y título.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        clave(empresaId),
        JSON.stringify({ pestanas: s.pestanas.map(({ id, url, titulo }) => ({ id, url, titulo })), activa: s.activa }),
      );
    } catch {
      /* noop */
    }
  }, [empresaId, s.pestanas, s.activa]);

  useEffect(() => {
    // Si el router ya salió de esta empresa (cambio de empresa en curso), no hay que traerlo de vuelta.
    if (!dentroDeEmpresa(window.location.pathname, empresaId)) return;
    if (window.location.pathname + window.location.search !== activa.url) {
      window.history.replaceState(null, "", activa.url);
    }
    document.title = `${activa.titulo} · Tessora ERP`;
  }, [empresaId, activa.url, activa.titulo]);

  useEffect(() => {
    marcos.current.get(s.activa)?.contentWindow?.focus();
  }, [s.activa]);

  useEffect(() => registrarAbridor(abrir), [abrir]);

  // Mensajes de las pestañas.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      let id: string | null = null;
      for (const [k, f] of marcos.current) if (f.contentWindow === e.source) id = k;
      if (!id) return;
      const m = e.data as MensajeWs;
      switch (m?.tipo) {
        case "nav":
          if (dentroDeEmpresa(rutaDe(m.url), empresaId)) dispatch({ tipo: "nav", id, url: m.url, titulo: m.titulo });
          else router.push(m.url);
          break;
        case "abrir":
          abrir(m.url);
          break;
        case "salir":
          router.push(m.url);
          break;
        case "tecla":
          dispatch({ tipo: "tecla", accion: m.accion });
          break;
        case "historial":
          dispatch({ tipo: "activar", id });
          break;
        case "buscar":
          pedirBuscador();
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [empresaId, abrir, router]);

  // Atajos y enlaces del cromo (árbol, header): todo destino de la empresa abre pestaña nueva.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const accion = accionDeTecla(e);
      if (!accion) return;
      e.preventDefault();
      dispatch({ tipo: "tecla", accion });
    }
    function onClick(e: MouseEvent) {
      const enlace = enlaceDeClick(e);
      if (!enlace || !dentroDeEmpresa(enlace.url.pathname, empresaId) || esRutaSuelta(enlace.url.pathname)) return;
      e.preventDefault();
      abrir(enlace.url.pathname + enlace.url.search + enlace.url.hash);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClick, true);
    window.addEventListener("auxclick", onClick, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("auxclick", onClick, true);
    };
  }, [empresaId, abrir]);

  // El tema claro/oscuro se alterna en la ventana principal: se replica en las pestañas.
  useEffect(() => {
    const html = document.documentElement;
    const obs = new MutationObserver(() => {
      const oscuro = html.classList.contains("dark");
      for (const f of marcos.current.values()) {
        f.contentDocument?.documentElement.classList.toggle("dark", oscuro);
      }
    });
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const montadas = s.pestanas.filter((p) => s.vivas.includes(p.id)).sort((a, b) => a.n - b.n);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BarraPestanas
        pestanas={s.pestanas}
        activa={s.activa}
        vivas={s.vivas}
        onActivar={(id) => dispatch({ tipo: "activar", id })}
        onCerrar={(id) => dispatch({ tipo: "cerrar", id })}
        onNueva={() => abrir(`/panel/${empresaId}`)}
      />
      <div className="relative min-h-0 flex-1">
        {montadas.map((p) => (
          <Marco key={p.id} pestana={p} visible={p.id === s.activa} registrar={registrarMarco} />
        ))}
      </div>
    </div>
  );
}

function Marco({
  pestana,
  visible,
  registrar,
}: {
  pestana: Pestana;
  visible: boolean;
  registrar: (id: string, el: HTMLIFrameElement | null) => void;
}) {
  // El src se fija al montar: las navegaciones dentro de la pestaña no deben recargar el iframe.
  const [src] = useState(pestana.url);
  const { id } = pestana;
  const ref = useCallback((el: HTMLIFrameElement | null) => registrar(id, el), [id, registrar]);
  return (
    <iframe
      ref={ref}
      src={src}
      title={pestana.titulo}
      aria-hidden={visible ? undefined : true}
      className={cn(
        "absolute inset-0 size-full border-0 bg-background",
        !visible && "pointer-events-none invisible",
      )}
    />
  );
}

function BarraPestanas({
  pestanas,
  activa,
  vivas,
  onActivar,
  onCerrar,
  onNueva,
}: {
  pestanas: Pestana[];
  activa: string;
  vivas: string[];
  onActivar: (id: string) => void;
  onCerrar: (id: string) => void;
  onNueva: () => void;
}) {
  const activaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activaRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activa]);

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-border bg-gray-50">
      <div role="tablist" aria-label="Pantallas abiertas" className="flex min-w-0 items-stretch overflow-x-auto">
        {pestanas.map((p, i) => {
          const esActiva = p.id === activa;
          const enReposo = !vivas.includes(p.id);
          const atajo = i < 8 ? ` (Alt+${i + 1})` : i === pestanas.length - 1 ? " (Alt+9)" : "";
          return (
            <div
              key={p.id}
              ref={esActiva ? activaRef : undefined}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  onCerrar(p.id);
                }
              }}
              className={cn(
                "group flex max-w-56 min-w-28 shrink-0 items-center border-r border-t-2 border-r-border text-sm",
                esActiva
                  ? "border-t-teal-500 bg-background font-medium text-foreground"
                  : "border-t-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={esActiva}
                title={`${p.titulo}${atajo}${enReposo ? " · en reposo, se recarga al abrirla" : ""}`}
                onClick={() => onActivar(p.id)}
                className={cn("min-w-0 flex-1 truncate py-1 pl-3 text-left", enReposo && "italic opacity-70")}
              >
                {p.titulo}
              </button>
              <button
                type="button"
                title="Cerrar (Alt+W)"
                aria-label={`Cerrar ${p.titulo}`}
                onClick={() => onCerrar(p.id)}
                className={cn(
                  "mx-1 flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted-foreground/15",
                  !esActiva && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                )}
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onNueva}
        title="Nueva pestaña"
        aria-label="Nueva pestaña"
        className="flex w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}
