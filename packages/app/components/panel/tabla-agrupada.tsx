"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";

/**
 * Agrupa `items` por `claveDe(item)`, preservando el orden de aparición del primer item
 * de cada grupo. Usado junto a `useExpandidos`/`FilaGrupo` para listas que parten
 * colapsadas por grupo y el usuario expande la que le interesa.
 */
export function agruparPor<T, K extends string>(items: T[], claveDe: (item: T) => K): Map<K, T[]> {
  const grupos = new Map<K, T[]>();
  for (const item of items) {
    const clave = claveDe(item);
    const arr = grupos.get(clave);
    if (arr) arr.push(item);
    else grupos.set(clave, [item]);
  }
  return grupos;
}

/** Set de claves de grupo expandidas — todo empieza colapsado. */
export function useExpandidos() {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const alternar = (clave: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  return { expandidos, alternar };
}

/** Fila de encabezado de grupo dentro de un `<TableBody>` — clic para expandir/colapsar. */
export function FilaGrupo({
  abierto,
  onToggle,
  colSpan,
  children,
}: {
  abierto: boolean;
  onToggle: () => void;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <TableRow
      className="cursor-pointer bg-muted/40 hover:bg-muted/60"
      onClick={onToggle}
      role="button"
      aria-expanded={abierto}
    >
      <TableCell colSpan={colSpan} className="py-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          {abierto ? (
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {children}
        </span>
      </TableCell>
    </TableRow>
  );
}

/** Memoiza el agrupamiento — evita recalcularlo en cada render. */
export function useAgrupado<T, K extends string>(items: T[], claveDe: (item: T) => K): Map<K, T[]> {
  return useMemo(() => agruparPor(items, claveDe), [items, claveDe]);
}
