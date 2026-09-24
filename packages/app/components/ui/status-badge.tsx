import { cn } from "@/lib/utils"

type Tono = "success" | "warning" | "danger" | "info" | "neutral"

const TONO_DOT: Record<Tono, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-disabled-foreground",
}

const TONO_TEXT: Record<Tono, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-muted-foreground",
}

/** Vocabulario de estados conocidos del sistema → tono semántico. */
const ESTADO_TONO: Record<string, Tono> = {
  Activo: "success",
  Activa: "success",
  Inactivo: "neutral",
  Inactiva: "neutral",
  Borrador: "neutral",
  Emitido: "success",
  Emitida: "success",
  Anulado: "danger",
  Anulada: "danger",
  Pagado: "success",
  Pagada: "success",
  Pendiente: "warning",
  Vencido: "danger",
  Vencida: "danger",
  Bloqueado: "danger",
  Bloqueada: "danger",
  Abierto: "success",
  Abierta: "success",
  Cerrado: "neutral",
  Cerrada: "neutral",
};

/**
 * Punto + texto para estados (Activo/Inactivo, Borrador/Emitido/Anulado, etc.)
 * — sin relleno fuerte, a diferencia de `Badge`. El tono se puede forzar con
 * `tono` cuando el texto no está en el diccionario de estados conocidos.
 */
export function StatusBadge({
  estado,
  tono,
  className,
}: {
  estado: string
  tono?: Tono
  className?: string
}) {
  const resuelto = tono ?? ESTADO_TONO[estado] ?? "neutral"
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", TONO_TEXT[resuelto], className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", TONO_DOT[resuelto])} />
      {estado}
    </span>
  )
}
