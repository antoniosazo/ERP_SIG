"use client";

import { useTransition } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { obtenerIniciales } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ userName, rolLabel }: { userName: string; rolLabel: string | null }) {
  const [, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 outline-none hover:bg-muted">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {obtenerIniciales(userName)}
        </span>
        <div className="hidden text-left leading-tight sm:block">
          <p className="text-sm font-medium">{userName}</p>
          {rolLabel && (
            <Badge variant="outline" className="h-4 border-transparent bg-teal-50 text-xs text-teal-700">
              {rolLabel}
            </Badge>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled>Mi perfil</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => logoutAction())}>
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
