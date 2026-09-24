"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Agrupa los miles de una parte entera (solo dígitos) con puntos, estilo es-CL. */
function agruparMiles(soloDigitos: string): string {
  return soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Normaliza texto tipeado libremente a "grupos.de.miles,decimales" (es-CL). */
function formatearMientrasSeEscribe(crudo: string, decimales: number): string {
  const negativo = crudo.trim().startsWith("-");
  const limpio = crudo.replace(/[^\d,]/g, "");
  const [enteroParte, ...resto] = limpio.split(",");
  const tieneComa = limpio.includes(",");
  const decimalParte = resto.join("").slice(0, decimales);
  const enteroSinCeros = (enteroParte ?? "").replace(/^0+(?=\d)/, "");
  const enteroFormateado = agruparMiles(enteroSinCeros || "0");
  return (negativo ? "-" : "") + enteroFormateado + (tieneComa ? "," + decimalParte : "");
}

function formatearDesdeNumero(n: number, decimales: number): string {
  if (n === 0) return "";
  return n.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: decimales });
}

function aNumero(formateado: string): number {
  const normal = formateado.replace(/\./g, "").replace(",", ".");
  const n = Number(normal);
  return Number.isNaN(n) ? 0 : n;
}

/** Cuenta cuántos caracteres "de valor" (dígitos, coma, signo) hay antes de una posición. */
function contarDigitosAntes(texto: string, posicion: number): number {
  return texto.slice(0, posicion).replace(/[^\d,-]/g, "").length;
}

/** Ubica la posición de cursor que deja el mismo número de caracteres "de valor" delante. */
function posicionParaDigitos(texto: string, digitos: number): number {
  if (digitos <= 0) return 0;
  let contados = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/[\d,-]/.test(texto[i]!)) contados++;
    if (contados >= digitos) return i + 1;
  }
  return texto.length;
}

/**
 * Input numérico con miles agrupados en vivo mientras se escribe (es-CL), sin símbolo de
 * moneda fijo — para montos en la moneda del documento (no siempre CLP). Controlado por
 * `valor`/`onValorChange`; preserva la posición del cursor al reformatear.
 */
export function MontoInput({
  valor,
  onValorChange,
  decimales = 2,
  disabled,
  className,
}: {
  valor: number;
  onValorChange: (valor: number) => void;
  decimales?: number;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState(() => formatearDesdeNumero(valor, decimales));
  const [enFoco, setEnFoco] = useState(false);

  useEffect(() => {
    if (!enFoco) setTexto(formatearDesdeNumero(valor, decimales));
  }, [valor, decimales, enFoco]);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={texto}
      onFocus={() => setEnFoco(true)}
      onBlur={() => {
        setEnFoco(false);
        setTexto(formatearDesdeNumero(valor, decimales));
      }}
      onChange={(e) => {
        const input = e.target;
        const cursorAntes = input.selectionStart ?? input.value.length;
        const digitosAntes = contarDigitosAntes(input.value, cursorAntes);

        const formateado = formatearMientrasSeEscribe(input.value, decimales);
        setTexto(formateado);
        onValorChange(aNumero(formateado));

        queueMicrotask(() => {
          if (!ref.current) return;
          const pos = posicionParaDigitos(formateado, digitosAntes);
          ref.current.setSelectionRange(pos, pos);
        });
      }}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-right text-sm tabular-nums transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}
