/** Helpers puros de la UI de periodos — sin "use client", se pueden usar desde server components. */

export function badgeVariantPeriodo(estado: string): "default" | "outline" | "secondary" {
  if (estado === "Desbloqueado") return "default";
  if (estado === "Período de cierre") return "outline";
  return "secondary";
}
