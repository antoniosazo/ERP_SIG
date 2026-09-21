"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { anularPagoAction } from "@/lib/actions/pagos";
import { Button } from "@/components/ui/button";

export function PagoAnularBoton({ empresaId, pagoId }: { empresaId: string; pagoId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function anular() {
    const motivo = prompt("Motivo de la anulación:");
    if (!motivo?.trim()) return;
    startTransition(async () => {
      const r = await anularPagoAction(empresaId, pagoId, { motivo });
      if (r.ok) {
        toast.success("Pago anulado; los documentos recuperan su saldo.");
        router.refresh();
      } else toast.error(r.error);
    });
  }
  return (
    <Button type="button" variant="destructive" disabled={isPending} onClick={anular}>
      {isPending ? "Anulando…" : "Anular pago"}
    </Button>
  );
}
