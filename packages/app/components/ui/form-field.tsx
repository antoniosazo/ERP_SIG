import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Envuelve un control (Input/Select/Textarea/DatePicker/MoneyInput) con label
 * arriba, y helper o error debajo (13px) — el espacio del mensaje siempre está
 * reservado para que el layout no salte al aparecer un error.
 */
export function FormField({
  label,
  htmlFor,
  helper,
  error,
  required,
  className,
  children,
}: {
  label?: string
  htmlFor?: string
  helper?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="text-danger">*</span>}
        </Label>
      )}
      {children}
      <p className={cn("min-h-[16px] text-[13px]", error ? "text-danger" : "text-muted-foreground")}>
        {error ?? helper}
      </p>
    </div>
  )
}
