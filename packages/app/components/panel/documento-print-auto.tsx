"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Botón de impresión (oculto al imprimir) + auto-print al abrir la vista. */
export function DocumentoPrintAuto() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print mb-4 flex gap-2">
      <Button type="button" size="sm" onClick={() => window.print()}>
        Imprimir
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => window.close()}>
        Cerrar
      </Button>
    </div>
  );
}
