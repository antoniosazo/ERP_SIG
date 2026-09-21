"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

/** Fila de tabla que lleva a `href` al hacer clic en cualquier parte (salvo enlaces y botones propios). */
export function FilaEnlace({ href, title, children }: { href: string | null; title?: string; children: ReactNode }) {
  const router = useRouter();
  if (!href) return <TableRow>{children}</TableRow>;
  return (
    <TableRow
      className="cursor-pointer"
      title={title}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input")) return;
        router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}
