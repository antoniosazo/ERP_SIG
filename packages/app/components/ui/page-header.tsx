import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

export type Breadcrumb = { label: string; href?: string }

/**
 * Encabezado estándar de página: breadcrumb opcional, título (24px/600),
 * descripción opcional (gray-500) y un slot de acciones a la derecha.
 */
export function PageHeader({
  breadcrumb,
  title,
  description,
  actions,
}: {
  breadcrumb?: Breadcrumb[]
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="space-y-2" data-slot="page-header">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumb.map((b, i) => (
            <span key={`${b.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRightIcon className="size-3" aria-hidden="true" />}
              {b.href ? (
                <Link href={b.href} className="hover:text-foreground">
                  {b.label}
                </Link>
              ) : (
                <span className={i === 0 ? "" : "text-foreground"}>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
