"use client";

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { formatearRut } from "@erp/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type EmpresaOpcion = { id: string; razonSocial: string; rut: string };

/** Selector de empresa en el header del panel — cambia de empresa o vuelve a la cartera. */
export function EmpresaSwitcher({
  empresas,
  actual,
}: {
  empresas: EmpresaOpcion[];
  actual: EmpresaOpcion;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 outline-none hover:bg-gray-100">
        <div className="min-w-0 text-left leading-tight">
          <p className="max-w-48 truncate text-sm font-medium">{actual.razonSocial}</p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {formatearRut(actual.rut)}
          </p>
        </div>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {empresas.map((e) => (
          <DropdownMenuItem key={e.id} asChild>
            <Link href={`/panel/${e.id}`} className="flex flex-col items-start gap-0">
              <span className="truncate text-sm">{e.razonSocial}</span>
              <span className="truncate text-xs text-muted-foreground tabular-nums">
                {formatearRut(e.rut)}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/empresas">Ver todas las empresas</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
