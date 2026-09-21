"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { anularDepositoAction } from "@/lib/actions/cheques";
import { Button } from "@/components/ui/button";

export function DepositoAnularBoton({ empresaId, depositoId }: { empresaId: string; depositoId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function anular() {
    const motivo = prompt("Motivo de la anulación del depósito:");
    if (!motivo?.trim()) return;
    startTransition(async () => {
      const r = await anularDepositoAction(empresaId, depositoId, { motivo });
      if (r.ok) {
        toast.success("Depósito anulado; los cheques vuelven a cartera.");
        router.refresh();
      } else toast.error(r.error);
    });
  }
  return (
    <Button type="button" variant="destructive" disabled={isPending} onClick={anular}>
      {isPending ? "Anulando…" : "Anular depósito"}
    </Button>
  );
}
