"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatearNumero, parsearNumero, type FormatoNumero } from "@erp/shared";
import { guardarTiposCambioAction } from "@/lib/actions/tipos-cambio";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Moneda = { id: string; codigo: string; nombre: string };
type Valor = { monedaId: string; fecha: string; valorEnClp: string };

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

const clave = (monedaId: string, fecha: string) => `${monedaId}|${fecha}`;

export function TiposCambioGrid({
  empresaId,
  anio,
  mes,
  monedas,
  valores,
  formato,
  decimales,
}: {
  empresaId: string;
  anio: number;
  mes: number;
  monedas: Moneda[];
  valores: Valor[];
  formato: FormatoNumero;
  decimales: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // En el input editable se usa el separador decimal configurado pero SIN agrupar miles.
  const fmtInput: FormatoNumero = { separadorDecimal: formato.separadorDecimal, separadorMiles: "" };

  const inicial = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of valores) {
      m.set(clave(v.monedaId, v.fecha), formatearNumero(v.valorEnClp, decimales, fmtInput));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores, decimales, formato.separadorDecimal]);

  const [celdas, setCeldas] = useState<Map<string, string>>(() => new Map(inicial));

  const dias = useMemo(() => {
    const total = new Date(anio, mes, 0).getDate();
    return Array.from({ length: total }, (_, i) => {
      const dd = String(i + 1).padStart(2, "0");
      const fecha = `${anio}-${String(mes).padStart(2, "0")}-${dd}`;
      const dow = new Date(anio, mes - 1, i + 1).getDay();
      return { dia: i + 1, fecha, dow, finde: dow === 0 || dow === 6 };
    });
  }, [anio, mes]);

  function setCelda(monedaId: string, fecha: string, valor: string) {
    setCeldas((prev) => {
      const next = new Map(prev);
      if (valor === "") next.delete(clave(monedaId, fecha));
      else next.set(clave(monedaId, fecha), valor);
      return next;
    });
  }

  const diff = useMemo(() => {
    const cambios: { monedaId: string; fecha: string; valor: number | null }[] = [];
    const keys = new Set([...inicial.keys(), ...celdas.keys()]);
    for (const k of keys) {
      const antes = inicial.get(k);
      const ahora = celdas.get(k);
      if ((antes ?? "") === (ahora ?? "")) continue;
      const [monedaId, fecha] = k.split("|");
      if (ahora == null || ahora.trim() === "") {
        cambios.push({ monedaId: monedaId!, fecha: fecha!, valor: null });
      } else {
        const n = parsearNumero(ahora, formato);
        cambios.push({ monedaId: monedaId!, fecha: fecha!, valor: n ?? NaN });
      }
    }
    return cambios;
  }, [inicial, celdas, formato]);

  function irA(nuevoAnio: number, nuevoMes: number) {
    router.push(`${pathname}?anio=${nuevoAnio}&mes=${nuevoMes}`);
  }

  function guardar() {
    if (diff.some((c) => c.valor !== null && (!Number.isFinite(c.valor) || c.valor <= 0))) {
      toast.error("Hay valores inválidos: usa números positivos.");
      return;
    }
    startTransition(async () => {
      const r = await guardarTiposCambioAction(empresaId, { cambios: diff });
      if (r.ok) {
        toast.success(`Guardado: ${r.guardados} valor(es), ${r.borrados} borrado(s)`);
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  const anios = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(mes)} onValueChange={(v) => irA(anio, Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((nombre, i) => (
              <SelectItem key={i} value={String(i + 1)}>
                {nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(anio)} onValueChange={(v) => irA(Number(v), mes)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anios.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={guardar} disabled={isPending || diff.length === 0}>
            {isPending ? "Guardando..." : `Guardar cambios${diff.length ? ` (${diff.length})` : ""}`}
          </Button>
        </div>
      </div>

      {monedas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta empresa no tiene monedas además de la funcional. Agrégalas en{" "}
          <span className="font-medium">Monedas</span> para cargarles tipo de cambio.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full border-collapse text-sm [&_td]:border [&_td]:border-border [&_th]:border [&_th]:border-border">
            <thead>
              <tr className="bg-muted/40">
                <th className="w-24 px-3 py-2 text-left font-medium">Día</th>
                {monedas.map((m) => (
                  <th key={m.id} className="px-3 py-2 text-right font-medium" title={m.nombre}>
                    {m.codigo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.map(({ dia, fecha, dow, finde }) => (
                <tr key={fecha} className={finde ? "bg-muted/20" : undefined}>
                  <td className="px-3 py-1 text-muted-foreground">
                    {String(dia).padStart(2, "0")}{" "}
                    <span className="text-xs">{DIAS_SEMANA[dow]}</span>
                  </td>
                  {monedas.map((m) => {
                    const k = clave(m.id, fecha);
                    const val = celdas.get(k) ?? "";
                    return (
                      <td key={m.id} className={val === "" ? "bg-destructive/5 p-0" : "p-0"}>
                        <input
                          inputMode="decimal"
                          value={val}
                          onChange={(e) => setCelda(m.id, fecha, e.target.value)}
                          className="w-full bg-transparent px-3 py-1 text-right tabular-nums outline-none focus:bg-accent"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 text-xs text-muted-foreground">
                <td className="px-3 py-1.5">Días sin valor</td>
                {monedas.map((m) => {
                  const faltan = dias.filter((d) => !celdas.get(clave(m.id, d.fecha))).length;
                  return (
                    <td key={m.id} className="px-3 py-1.5 text-right">
                      {faltan}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Valor = cuánto vale 1 unidad de esa moneda en la moneda funcional. Separador
        decimal «{formato.separadorDecimal}» (configurable en Visualización).
      </p>
    </div>
  );
}
