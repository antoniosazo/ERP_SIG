"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon } from "lucide-react";
import { toast } from "sonner";
import { entrarFirmaAction } from "@/lib/actions/acceso-firmas";
import { Button } from "@/components/ui/button";

export function EntrarFirmaButton({ firmaId, nombre, disponible }: { firmaId: string; nombre: string; disponible: boolean }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      disabled={!disponible || pendiente}
      aria-label={`Entrar a ${nombre}`}
      title={disponible ? "Abrir esta firma y sus empresas cliente" : "Activa la firma y prepara su base para entrar"}
      onClick={() => startTransition(async () => {
        const resultado = await entrarFirmaAction(firmaId);
        if (!resultado.ok) {
          toast.error(resultado.error);
          return;
        }
        // Primero la página de la firma; desde ahí se llega a sus empresas.
        router.push("/admin/firmas");
      })}
    >
      {pendiente ? "Entrando…" : "Entrar"}
      {!pendiente && <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />}
    </Button>
  );
}
