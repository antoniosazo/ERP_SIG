"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import { elegirFirmaAction } from "@/lib/actions/acceso-firmas";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type FirmaOpcion = { id: string; nombre: string; esAdminFirma: boolean };

/** Firma con la que se trabaja y cambio a otra, para quien pertenece a varias. */
export function SelectorFirma({ firmas, actualId, actualNombre }: { firmas: FirmaOpcion[]; actualId: string; actualNombre: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function elegir(id: string) {
    if (id === actualId) return;
    startTransition(async () => {
      const r = await elegirFirmaAction(id);
      if (!r.ok) return void toast.error(r.error);
      // La raíz decide la página de inicio de esa firma según el rol que tiene en ella.
      router.push("/");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="flex max-w-56 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm outline-none hover:bg-muted"
        aria-label="Cambiar de firma"
      >
        <BuildingIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{actualNombre}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {firmas.map((f) => (
          <DropdownMenuItem key={f.id} onSelect={() => elegir(f.id)} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              {f.nombre}
              {f.esAdminFirma && <span className="ml-1.5 text-xs text-muted-foreground">Admin</span>}
            </span>
            {f.id === actualId && <CheckIcon className="size-4 shrink-0" aria-label="Firma actual" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
