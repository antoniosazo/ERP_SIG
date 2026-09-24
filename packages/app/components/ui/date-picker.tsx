import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Selector de fecha. Usa el input nativo del navegador (ya validado y accesible
 * en todo el sistema) con el mismo tratamiento visual que el resto de los
 * controles — evita sumar una librería de calendario solo para esto.
 */
function DatePicker({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <input
        type="date"
        data-slot="date-picker"
        className={cn(
          "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-3 pl-9 text-sm transition-colors outline-none [color-scheme:light] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:text-disabled-foreground disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 dark:[color-scheme:dark] dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/25",
          className
        )}
        {...props}
      />
      <CalendarIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { DatePicker }
