"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetearPasswordAction } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { LinkGenerado } from "@/components/link-generado";

export function ResetearPasswordButton({ usuarioId }: { usuarioId: string }) {
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await resetearPasswordAction(usuarioId);
            if (result.ok) {
              setToken(result.token);
            } else {
              toast.error(result.error);
            }
          });
        }}
      >
        {isPending ? "Generando..." : "Resetear contraseña"}
      </Button>
      {token && <LinkGenerado token={token} />}
    </div>
  );
}
