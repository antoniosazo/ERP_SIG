import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import type { NodoMapaDTO } from "@/lib/mapa-grafo";
import { cn } from "@/lib/utils";

/** Etapas del proceso del documento (orden de compra → entrada → factura → pago), con el actual resaltado. */
export function CadenaDocumentos({ etapas }: { etapas: NodoMapaDTO[][] }) {
  return (
    <nav aria-label="Etapas del proceso" className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
      {etapas.map((etapa, i) => (
        <div key={etapa.map((n) => n.clave).join("|")} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden />}
          <div className="flex flex-wrap items-center gap-1">
            {etapa.map((n) => {
              const cuerpo = (
                <>
                  <span className="font-medium">{n.tipo}</span>{" "}
                  <span className="font-mono text-muted-foreground">{n.numero.split(" · ")[0]}</span>
                </>
              );
              const clases = cn(
                "rounded-md border px-2 py-1",
                n.raiz ? "border-amber-400 bg-amber-200 text-amber-950" : "bg-background hover:bg-muted",
              );
              return n.raiz || !n.href ? (
                <span key={n.clave} className={clases} aria-current={n.raiz ? "step" : undefined}>{cuerpo}</span>
              ) : (
                <Link key={n.clave} href={n.href} className={clases}>{cuerpo}</Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
