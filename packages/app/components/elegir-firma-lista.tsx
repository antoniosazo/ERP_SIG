"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon } from "lucide-react";
import { toast } from "sonner";
import { elegirFirmaAction } from "@/lib/actions/acceso-firmas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ElegirFirmaLista({ firmas }: { firmas: { id: string; nombre: string; esAdminFirma: boolean }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [eligiendo, setEligiendo] = useState<string | null>(null);

  return (
    <ul className="space-y-2">
      {firmas.map((f) => (
        <li key={f.id}>
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full justify-between gap-3 px-4 py-3 text-left"
            disabled={isPending}
            onClick={() => {
              setEligiendo(f.id);
              startTransition(async () => {
                const r = await elegirFirmaAction(f.id);
                if (!r.ok) {
                  setEligiendo(null);
                  return void toast.error(r.error);
                }
                // La raíz lleva a la página de inicio que corresponde al rol del usuario en esa firma.
                router.push("/");
                router.refresh();
              });
            }}
          >
            <span className="flex min-w-0 items-center gap-3">
              <BuildingIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate font-medium">{f.nombre}</span>
            </span>
            {eligiendo === f.id ? <span className="text-xs text-muted-foreground">Entrando…</span> : f.esAdminFirma && <Badge>Administrador</Badge>}
          </Button>
        </li>
      ))}
    </ul>
  );
}
