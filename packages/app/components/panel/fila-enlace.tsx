"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { abrirPestana } from "@/components/panel/workspace";

/**
 * Fila de tabla que lleva a `href` al hacer clic en cualquier parte (salvo enlaces y botones propios).
 * Ctrl/⌘+clic o clic medio la abren en otra pestaña, como un enlace.
 */
export function FilaEnlace({ href, title, children }: { href: string | null; title?: string; children: ReactNode }) {
  const router = useRouter();
  if (!href) return <TableRow>{children}</TableRow>;
  return (
    <TableRow
      className="cursor-pointer"
      title={title}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input")) return;
        if (e.ctrlKey || e.metaKey) {
          if (!abrirPestana(href)) window.open(href, "_blank");
        } else router.push(href);
      }}
      onAuxClick={(e) => {
        if (e.button !== 1 || (e.target as HTMLElement).closest("a, button, input")) return;
        if (!abrirPestana(href)) window.open(href, "_blank");
      }}
    >
      {children}
    </TableRow>
  );
}
