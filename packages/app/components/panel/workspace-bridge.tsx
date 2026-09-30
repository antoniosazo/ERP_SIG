"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  accionDeTecla,
  dentroDeEmpresa,
  enlaceDeClick,
  enviarAlPadre,
  esAtajoBuscar,
  esRutaSuelta,
  modoEmbebido,
  modoServidor,
  registrarVisita,
  suscribirModo,
  tituloDePagina,
} from "@/components/panel/workspace";

/**
 * Lado embebido del espacio de trabajo: informa a la ventana principal la URL y el título de
 * la pestaña, le reenvía los atajos y le pide abrir en pestaña nueva los Ctrl+clic, clic medio
 * y enlaces `target="_blank"`. No hace nada fuera de un iframe.
 */
export function WorkspaceBridge({ empresaId }: { empresaId: string }) {
  const embebido = useSyncExternalStore(suscribirModo, modoEmbebido, modoServidor);
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const informar = useRef<() => void>(() => {});

  // URL y título: tras cada navegación y cada vez que cambia el encabezado de la página.
  useEffect(() => {
    if (!embebido) return;
    let ultimo = "";
    let timer: number | undefined;
    informar.current = () => {
      const url = window.location.pathname + window.location.search;
      const titulo = tituloDePagina(empresaId);
      if (url + "\n" + titulo === ultimo) return;
      ultimo = url + "\n" + titulo;
      enviarAlPadre({ tipo: "nav", url, titulo });
    };
    const obs = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => informar.current(), 120);
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => {
      obs.disconnect();
      window.clearTimeout(timer);
    };
  }, [embebido, empresaId]);

  useEffect(() => {
    if (!embebido) return;
    registrarVisita(pathname + (query ? `?${query}` : ""));
    informar.current();
  }, [embebido, pathname, query]);

  useEffect(() => {
    if (!embebido) return;

    function onClick(e: MouseEvent) {
      const enlace = enlaceDeClick(e);
      if (!enlace || esRutaSuelta(enlace.url.pathname)) return;
      const { a, url } = enlace;
      const destino = url.pathname + url.search + url.hash;
      if (!dentroDeEmpresa(url.pathname, empresaId)) {
        // Otra empresa, administración, etc.: navega la ventana principal, no la pestaña.
        if (a.target === "_blank") return;
        e.preventDefault();
        enviarAlPadre({ tipo: "salir", url: destino });
        return;
      }
      if (e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey || a.target === "_blank") {
        e.preventDefault();
        enviarAlPadre({ tipo: "abrir", url: destino });
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      const accion = accionDeTecla(e);
      if (accion) {
        e.preventDefault();
        e.stopPropagation();
        enviarAlPadre({ tipo: "tecla", accion });
      } else if (esAtajoBuscar(e)) {
        e.preventDefault();
        e.stopPropagation();
        enviarAlPadre({ tipo: "buscar" });
      }
    }

    // Atrás/Adelante del navegador mueve la pestaña que navegó por última vez: que se vea.
    const onPopState = () => enviarAlPadre({ tipo: "historial" });

    window.addEventListener("click", onClick, true);
    window.addEventListener("auxclick", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("auxclick", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [embebido, empresaId]);

  return null;
}

/**
 * Montado en el layout raíz: si una pestaña termina fuera del panel (sesión vencida → login,
 * cierre de sesión, etc.), lleva a la ventana principal allá en vez de mostrarlo dentro.
 */
export function SalidaDeMarco() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.top !== window.self && !pathname.startsWith("/panel/")) {
      window.top?.location.assign(window.location.href);
    }
  }, [pathname]);
  return null;
}
