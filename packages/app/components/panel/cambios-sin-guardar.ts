"use client";

import { useEffect } from "react";
import { enlaceDeClick, modoWorkspace } from "@/components/panel/workspace";

/**
 * Registro de formularios con cambios sin guardar en este documento. Lo usan el aviso nativo
 * del navegador (recargar/cerrar), el aviso al salir por un enlace y, dentro de una pestaña del
 * espacio de trabajo, el puente que le informa a la barra de pestañas (● y confirmación al cerrar).
 */
const sucios = new Set<symbol>();
const oyentes = new Set<() => void>();

function emitir() {
  for (const fn of oyentes) fn();
}

function antesDeDescargar(e: BeforeUnloadEvent) {
  e.preventDefault();
}

export function hayCambiosSinGuardar(): boolean {
  return sucios.size > 0;
}

export function suscribirCambios(fn: () => void) {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/** Marca el documento como "con cambios sin guardar" mientras `sucio` sea true y el componente esté montado. */
export function useCambiosSinGuardar(sucio: boolean) {
  useEffect(() => {
    if (!sucio) return;
    const id = Symbol();
    sucios.add(id);
    if (sucios.size === 1) window.addEventListener("beforeunload", antesDeDescargar);
    emitir();
    return () => {
      sucios.delete(id);
      if (sucios.size === 0) window.removeEventListener("beforeunload", antesDeDescargar);
      emitir();
    };
  }, [sucio]);
}

export const MENSAJE_SALIR = "Tienes cambios sin guardar en esta pantalla. ¿Salir igual y perderlos?";

/**
 * Pide confirmación antes de seguir un enlace que reemplazaría esta pantalla con cambios sin
 * guardar. Los clics que abren otra pestaña, o que el espacio de trabajo ya tomó (`defaultPrevented`,
 * p. ej. salir a otra empresa, que confirma la barra de pestañas), no pasan por aquí.
 */
export function useGuardiaDeEnlaces() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || !hayCambiosSinGuardar() || modoWorkspace()) return;
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const enlace = enlaceDeClick(e);
      if (!enlace || enlace.a.target === "_blank") return;
      const { url } = enlace;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(MENSAJE_SALIR)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);
}
