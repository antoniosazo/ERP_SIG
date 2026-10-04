import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import { salirFirmaAction } from "@/lib/actions/acceso-firmas";
import { Button } from "@/components/ui/button";

/** Recordatorio persistente del contexto, incluso dentro de una pestaña del panel. */
export function ContextoFirmaBanner({ nombre }: { nombre: string }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <ShieldCheckIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="min-w-0 text-foreground">
          <span className="font-semibold">Acceso de superadmin:</span> {nombre}
          <span className="ml-2 text-muted-foreground">Las acciones se registran con tu usuario.</span>
        </p>
      </div>
      <form action={salirFirmaAction}>
        <Button type="submit" size="xs" variant="outline">
          <ArrowLeftIcon className="size-3" aria-hidden="true" /> Volver a firmas
        </Button>
      </form>
    </div>
  );
}
