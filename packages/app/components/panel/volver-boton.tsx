"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { anteriorDePestana, modoEmbebido } from "@/components/panel/workspace";

/**
 * Vuelve a la pantalla anterior (conserva filtros de la lista de origen). Si se abrió el
 * detalle directo, sin historial, va a `fallbackHref`. Dentro de una pestaña usa el historial
 * de esa pestaña: `router.back()` podría retroceder otra (el historial del navegador es común).
 */
export function VolverBoton({
  fallbackHref,
  className,
  etiqueta = "Volver",
}: {
  fallbackHref: string;
  className?: string;
  etiqueta?: string;
}) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => {
        if (modoEmbebido()) router.push(anteriorDePestana() ?? fallbackHref);
        else if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
    >
      <ArrowLeftIcon /> {etiqueta}
    </Button>
  );
}
