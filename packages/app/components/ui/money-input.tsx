"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const formateador = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 })

function formatear(valor: number | null): string {
  return valor === null || Number.isNaN(valor) ? "" : formateador.format(valor)
}

function aNumero(texto: string): number | null {
  const limpio = texto.replace(/[^\d]/g, "")
  if (!limpio) return null
  return Number(limpio)
}

/**
 * Input de monto en pesos chilenos: separador de miles, sin decimales, alineado
 * a la derecha y con el símbolo "$" fijo a la izquierda.
 */
function MoneyInput({
  className,
  value,
  onValueChange,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null
  onValueChange: (valor: number | null) => void
}) {
  const [texto, setTexto] = React.useState(() => formatear(value))

  React.useEffect(() => {
    setTexto(formatear(value))
  }, [value])

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <input
        type="text"
        inputMode="numeric"
        data-slot="money-input"
        disabled={disabled}
        value={texto}
        onChange={(e) => {
          const numero = aNumero(e.target.value)
          setTexto(numero === null ? "" : formateador.format(numero))
          onValueChange(numero)
        }}
        className={cn(
          "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-3 pl-6 text-right text-sm tabular-nums transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:text-disabled-foreground disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/25",
          className
        )}
        {...props}
      />
    </div>
  )
}

export { MoneyInput }
