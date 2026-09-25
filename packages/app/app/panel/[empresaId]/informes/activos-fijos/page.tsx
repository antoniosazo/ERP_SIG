import { LIBRO_CONTABLE, type LibroContable } from "@erp/shared";
import { cuadroEvolucion } from "@erp/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("es-CL");

export default async function CuadroEvolucionActivoFijoPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ anio?: string; libro?: string }>;
}) {
  const { empresaId } = await params;
  const sp = await searchParams;
  const anio = sp.anio && /^\d{4}$/.test(sp.anio) ? Number(sp.anio) : new Date().getFullYear();
  const libro: LibroContable = (LIBRO_CONTABLE as readonly string[]).includes(sp.libro ?? "")
    ? (sp.libro as LibroContable)
    : "Ambos";

  const filas = await cuadroEvolucion(empresaId, libro, anio);
  const totales = filas.reduce(
    (a, f) => ({
      costoInicial: a.costoInicial + f.costoInicial,
      altas: a.altas + f.altas,
      costoFinal: a.costoFinal + f.costoFinal,
      depAcumuladaInicial: a.depAcumuladaInicial + f.depAcumuladaInicial,
      depEjercicio: a.depEjercicio + f.depEjercicio,
      depAcumuladaFinal: a.depAcumuladaFinal + f.depAcumuladaFinal,
      valorLibro: a.valorLibro + f.valorLibro,
    }),
    { costoInicial: 0, altas: 0, costoFinal: 0, depAcumuladaInicial: 0, depEjercicio: 0, depAcumuladaFinal: 0, valorLibro: 0 },
  );

  return (
    <>
      <TypographyHeading
        title="Cuadro de evolución del activo fijo"
        description="Costo y depreciación acumulada del ejercicio, por activo."
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="anio" className="text-xs text-muted-foreground">
            Año
          </label>
          <Input id="anio" name="anio" type="number" defaultValue={anio} className="h-8 w-28" />
        </div>
        <div className="space-y-1">
          <label htmlFor="libro" className="text-xs text-muted-foreground">
            Libro
          </label>
          <Select name="libro" defaultValue={libro}>
            <SelectTrigger id="libro" className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIBRO_CONTABLE.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" variant="outline">
          Consultar
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Activo</th>
              <th className="px-3 py-2">Clase</th>
              <th className="px-3 py-2 text-right">Costo inicial</th>
              <th className="px-3 py-2 text-right">Altas</th>
              <th className="px-3 py-2 text-right">Costo final</th>
              <th className="px-3 py-2 text-right">Dep. acum. inicial</th>
              <th className="px-3 py-2 text-right">Dep. ejercicio</th>
              <th className="px-3 py-2 text-right">Dep. acum. final</th>
              <th className="px-3 py-2 text-right">Valor libro</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-2 text-sm text-muted-foreground">
                  Sin activos para este libro.
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.activoId} className="border-t">
                <td className="px-3 py-1.5">
                  <span className="font-mono text-muted-foreground">{f.codigo}</span> {f.descripcion}
                </td>
                <td className="px-3 py-1.5">{f.claseNombre}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.costoInicial)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.altas)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.costoFinal)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.depAcumuladaInicial)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.depEjercicio)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.depAcumuladaFinal)}</td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">{fmt(f.valorLibro)}</td>
              </tr>
            ))}
            {filas.length > 0 && (
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totales.costoInicial)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totales.altas)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totales.costoFinal)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totales.depAcumuladaInicial)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totales.depEjercicio)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totales.depAcumuladaFinal)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(totales.valorLibro)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
