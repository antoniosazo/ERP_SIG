"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reintentarBaseFirmaAction } from "@/lib/actions/firmas";
import { LinkGenerado } from "@/components/link-generado";
import { Button } from "@/components/ui/button";

/** Reintenta el alta de la base de una firma en error y muestra los links de invitación renovados. */
export function ReintentarBaseFirma({ firmaId }: { firmaId: string }) {
  const [isPending, startTransition] = useTransition();
  const [invitaciones, setInvitaciones] = useState<{ email: string; token: string }[]>([]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="xs"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await reintentarBaseFirmaAction(firmaId);
            if (r.ok) {
              setInvitaciones(r.invitaciones);
              toast.success("La base de la firma quedó lista.");
            } else toast.error(r.error);
          })
        }
      >
        {isPending ? "Creando base… (puede tardar un minuto)" : "Reintentar"}
      </Button>
      {invitaciones.map((i) => (
        <div key={i.token} className="space-y-1">
          <p className="text-xs text-muted-foreground">Invitación para {i.email}:</p>
          <LinkGenerado token={i.token} />
        </div>
      ))}
    </div>
  );
}
