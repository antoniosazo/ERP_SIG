"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  MoreHorizontalIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableSkeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type DataTableColumn<T> = {
  key: string
  header: string
  align?: "left" | "right"
  sortable?: boolean
  sortValue?: (row: T) => string | number
  cell: (row: T) => React.ReactNode
  className?: string
}

/** Barra de herramientas de tabla: buscador a la izquierda, filtros al centro, acción primaria a la derecha. */
export function TableToolbar({
  query,
  onQueryChange,
  placeholder = "Buscar…",
  filters,
  action,
}: {
  query?: string
  onQueryChange?: (value: string) => void
  placeholder?: string
  filters?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {onQueryChange && (
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={placeholder}
              className="h-10 w-64 pl-9"
            />
          </div>
        )}
        {filters}
      </div>
      {action}
    </div>
  )
}

/**
 * Tabla de datos genérica: header sticky, filas de 44px, alineación numérica a
 * la derecha con tabular-nums, selección múltiple con barra de acciones
 * masivas, columna de acciones (⋯), orden por columna y paginación.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  rowActions,
  selectable = false,
  renderBulkActions,
  pageSize = 20,
  loading = false,
  emptyIcon: EmptyIcon,
  emptyTitle = "No hay datos para mostrar",
  emptyDescription,
  emptyAction,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  rowActions?: (row: T) => React.ReactNode
  selectable?: boolean
  renderBulkActions?: (selectedIds: string[]) => React.ReactNode
  pageSize?: number
  loading?: boolean
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
}) {
  const [seleccion, setSeleccion] = React.useState<Set<string>>(new Set())
  const [orden, setOrden] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  const [pagina, setPagina] = React.useState(1)

  const ordenadas = React.useMemo(() => {
    if (!orden) return rows
    const columna = columns.find((c) => c.key === orden.key)
    if (!columna?.sortValue) return rows
    const copia = [...rows]
    copia.sort((a, b) => {
      const va = columna.sortValue!(a)
      const vb = columna.sortValue!(b)
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return orden.dir === "asc" ? cmp : -cmp
    })
    return copia
  }, [rows, orden, columns])

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / pageSize))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const inicio = (paginaSegura - 1) * pageSize
  const visibles = ordenadas.slice(inicio, inicio + pageSize)

  function alternarOrden(key: string) {
    setOrden((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" }
      if (prev.dir === "asc") return { key, dir: "desc" }
      return null
    })
  }

  function alternarFila(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function alternarTodas() {
    setSeleccion((prev) => (prev.size === visibles.length ? new Set() : new Set(visibles.map(getRowId))))
  }

  if (loading) return <TableSkeleton columns={columns.length + (selectable ? 1 : 0)} />

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border">
        <EmptyState
          icon={EmptyIcon ?? SearchIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {selectable && seleccion.size > 0 && renderBulkActions && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-accent px-4 py-2 text-sm">
          <span className="font-medium text-accent-foreground">{seleccion.size} seleccionadas</span>
          <div className="flex items-center gap-2">{renderBulkActions([...seleccion])}</div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-muted">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={visibles.length > 0 && seleccion.size === visibles.length}
                    onChange={alternarTodas}
                    aria-label="Seleccionar todas las filas"
                    className="size-4 rounded border-input accent-primary"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                    col.align === "right" && "text-right",
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => alternarOrden(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        col.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {col.header}
                      {orden?.key === col.key ? (
                        orden.dir === "asc" ? (
                          <ArrowUpIcon className="size-3" />
                        ) : (
                          <ArrowDownIcon className="size-3" />
                        )
                      ) : (
                        <ArrowUpDownIcon className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {rowActions && <th className="w-10 px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {visibles.map((row) => {
              const id = getRowId(row)
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "h-11 border-t border-border first:border-t-0 hover:bg-gray-50 dark:hover:bg-muted/50",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {selectable && (
                    <td className="px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={seleccion.has(id)}
                        onChange={() => alternarFila(id)}
                        aria-label="Seleccionar fila"
                        className="size-4 rounded border-input accent-primary"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4",
                        col.align === "right" && "text-right tabular-nums",
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="Más acciones"
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">{rowActions(row)}</DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {ordenadas.length > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {inicio + 1}–{Math.min(inicio + pageSize, ordenadas.length)} de {ordenadas.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paginaSegura <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paginaSegura >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
