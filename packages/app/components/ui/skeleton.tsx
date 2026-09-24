import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  )
}

/** Esqueleto de una tabla — cabecera + N filas de anchos variados. */
function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex h-9 items-center gap-4 border-b border-border bg-muted/50 px-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-11 items-center gap-4 border-b border-border px-4 last:border-b-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3.5 flex-1", c === 0 && "max-w-40")} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Esqueleto de una tarjeta genérica (KPI, resumen, etc.). */
function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-border p-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

/** Esqueleto de un formulario — N pares label/control. */
function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, TableSkeleton, CardSkeleton, FormSkeleton }
