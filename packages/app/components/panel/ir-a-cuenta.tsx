import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

/**
 * Ícono de drill-down junto a un selector de cuenta contable — abre la ficha de esa
 * cuenta en Plan de Cuentas. No hace nada si no hay una cuenta seleccionada.
 */
export function IrACuenta({ empresaId, cuentaId }: { empresaId: string; cuentaId: string | undefined }) {
  if (!cuentaId) return null;
  return (
    <Link
      href={`/panel/${empresaId}/configuracion/plan-cuentas?cuenta=${cuentaId}`}
      target="_blank"
      title="Ir a configurar esta cuenta"
      className="inline-flex shrink-0 items-center text-muted-foreground hover:text-foreground"
    >
      <ExternalLinkIcon className="size-4" />
    </Link>
  );
}
