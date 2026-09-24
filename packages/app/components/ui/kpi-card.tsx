import type { ReactNode } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Tarjeta de indicador: label, valor grande y una variación o descripción. Clicable si lleva `href`. */
export function KpiCard({
  label,
  value,
  description,
  href,
  className,
}: {
  label: string
  value: ReactNode
  description?: ReactNode
  href?: string
  className?: string
}) {
  const contenido = (
    <Card
      className={cn(
        "h-full border-transparent transition hover:border-teal-500",
        href && "cursor-pointer",
        className,
      )}
      style={{ "--card-spacing": "1.25rem" } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {contenido}
    </Link>
  ) : (
    contenido
  );
}
