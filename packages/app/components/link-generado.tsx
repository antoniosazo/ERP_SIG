"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Muestra el link de activación/reseteo para copiar y enviar a mano (sin envío
 * automático de email por ahora — ver decisión de producto en el plan de Usuarios y Roles).
 */
export function LinkGenerado({ token }: { token: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/activar/${token}`);
  }, [token]);

  if (!url) return null;

  return (
    <div className="rounded-md border bg-muted/50 p-4">
      <p className="text-sm font-medium">Link generado — cópialo y envíaselo a la persona:</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-background px-2 py-1.5 text-xs">
          {url}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(url);
            toast.success("Link copiado");
          }}
        >
          Copiar
        </Button>
      </div>
    </div>
  );
}
