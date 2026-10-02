"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpcionBuscable = { id: string; label: string; detalle?: string };

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Select con búsqueda por texto para listas largas (plan de cuentas, socios). Filtra por
 * cualquier parte de la etiqueta, sin tildes; Enter elige la primera coincidencia.
 */
export function SelectorBuscable({
  opciones,
  value,
  onValueChange,
  valor,
  onCambio,
  placeholder = "Buscar…",
  disabled,
  className,
  ariaLabel,
  invalido,
}: {
  opciones: OpcionBuscable[];
  value?: string | null;
  onValueChange?: (id: string | undefined) => void;
  /** Nombres originales conservados para los formularios contables existentes. */
  valor?: string | null;
  onCambio?: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  permitirVacio?: boolean;
  etiquetaVacia?: string;
  titulo?: string;
  invalido?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [posicion, setPosicion] = useState<CSSProperties | null>(null);
  const valorActual = value ?? valor ?? null;
  const seleccionada = opciones.find((o) => o.id === valorActual);

  const filtradas = useMemo(() => {
    const q = normalizar(texto.trim());
    const base = q ? opciones.filter((o) => normalizar(`${o.label} ${o.detalle ?? ""}`).includes(q)) : opciones;
    return base.slice(0, 80);
  }, [opciones, texto]);

  // Las grillas y tablas recortan (overflow) lo que se dibuja dentro de ellas: la lista se saca
  // al body y se posiciona sobre el campo. Dentro de un diálogo se queda en línea, porque el
  // diálogo trata un clic fuera de él como cierre.
  useLayoutEffect(() => {
    if (!abierto || !raiz.current || raiz.current.closest('[role="dialog"]')) {
      setPosicion(null);
      return;
    }
    const campo = raiz.current;
    const calcular = () => {
      const r = campo.getBoundingClientRect();
      const ancho = Math.max(r.width, 288);
      const abajo = window.innerHeight - r.bottom;
      const arriba = abajo < 200 && r.top > abajo;
      setPosicion({
        position: "fixed",
        left: Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8)),
        width: ancho,
        ...(arriba ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
        maxHeight: Math.min(256, Math.max(120, (arriba ? r.top : abajo) - 12)),
      });
    };
    calcular();
    window.addEventListener("scroll", calcular, true);
    window.addEventListener("resize", calcular);
    return () => {
      window.removeEventListener("scroll", calcular, true);
      window.removeEventListener("resize", calcular);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      const destino = e.target as Node;
      if (!raiz.current?.contains(destino) && !lista.current?.contains(destino)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  function cambiar(id: string | null) {
    if (onValueChange) onValueChange(id ?? undefined);
    else onCambio?.(id);
  }

  function elegir(o: OpcionBuscable | undefined) {
    if (!o) return;
    cambiar(o.id);
    setAbierto(false);
    setTexto("");
  }

  return (
    <div ref={raiz} className={cn("relative", className)}>
      {abierto ? (
        <input
          autoFocus
          aria-label={ariaLabel}
          aria-invalid={invalido}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          placeholder={placeholder}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setActivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActivo((i) => Math.min(i + 1, filtradas.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              elegir(filtradas[activo]);
            } else if (e.key === "Escape" || e.key === "Tab") {
              setAbierto(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          data-invalid={invalido || undefined}
          onClick={() => setAbierto(true)}
          onFocus={(e) => {
            // Navegar con Tab abre el buscador, como el campo de cuenta de SAP.
            if (e.relatedTarget) setAbierto(true);
          }}
          className="flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-2 text-left text-sm disabled:opacity-50"
        >
          <span className={cn("truncate", !seleccionada && "text-muted-foreground")}>
            {seleccionada?.label ?? placeholder}
          </span>
          {seleccionada && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Quitar"
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                cambiar(null);
              }}
            >
              <XIcon className="size-3.5" />
            </span>
          ) : (
            <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
      )}
      {abierto && (() => {
        const opcionesLista = (
          <ul
            ref={lista}
            style={posicion ? { ...posicion, pointerEvents: "auto" } : undefined}
            className={cn(
              "overflow-y-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md",
              posicion ? "z-[60]" : "absolute z-50 mt-1 max-h-64 w-full min-w-72",
            )}
          >
            {filtradas.length === 0 ? (
              <li className="px-2 py-1.5 text-muted-foreground">Sin coincidencias</li>
            ) : (
              filtradas.map((o, i) => (
                <li
                  key={o.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(o);
                  }}
                  onMouseEnter={() => setActivo(i)}
                  className={cn("cursor-pointer rounded px-2 py-1.5", i === activo && "bg-accent text-accent-foreground")}
                >
                  <div className="truncate">{o.label}</div>
                  {o.detalle && <div className="truncate text-xs text-muted-foreground">{o.detalle}</div>}
                </li>
              ))
            )}
          </ul>
        );
        return posicion ? createPortal(opcionesLista, document.body) : opcionesLista;
      })()}
    </div>
  );
}
