import { cuadroEvolucion } from "@erp/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("es-CL");

export default async function ConciliacionActivoFijoPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ anio?: string }>;
}) {
  const { empresaId } = await params;
  const sp = await searchParams;
  const anio = sp.anio && /^\d{4}$/.test(sp.anio) ? Number(sp.anio) : new Date().getFullYear();

  const [tributario, ifrs] = await Promise.all([
    cuadroEvolucion(empresaId, "Tributario", anio),
    cuadroEvolucion(empresaId, "IFRS", anio),
  ]);
  const tributarioPorActivo = new Map(tributario.map((f) => [f.activoId, f]));
  const ifrsPorActivo = new Map(ifrs.map((f) => [f.activoId, f]));
  const activoIds = [...new Set([...tributarioPorActivo.keys(), ...ifrsPorActivo.keys()])];

  const filas = activoIds
    .map((id) => {
      const t = tributarioPorActivo.get(id);
      const i = ifrsPorActivo.get(id);
      const codigo = t?.codigo ?? i?.codigo ?? "";
      const descripcion = t?.descripcion ?? i?.descripcion ?? "";
      const costoTributario = t?.costoFinal ?? 0;
      const costoIfrs = i?.costoFinal ?? 0;
      const depTributario = t?.depAcumuladaFinal ?? 0;
      const depIfrs = i?.depAcumuladaFinal ?? 0;
      return {
        activoId: id,
        codigo,
        descripcion,
        costoTributario,
        costoIfrs,
        difCosto: costoTributario - costoIfrs,
        depTributario,
        depIfrs,
        difDep: depTributario - depIfrs,
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  return (
    <>
      <TypographyHeading
        title="Conciliación Tributario / IFRS"
        description="Costo y depreciación acumulada de cada activo en ambos libros, lado a lado, para el año elegido."
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="anio" className="text-xs text-muted-foreground">Año</label>
          <Input id="anio" name="anio" type="number" defaultValue={anio} className="h-8 w-28" />
        </div>
        <Button type="submit" size="sm" variant="outline">Consultar</Button>
      </form>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Activo</th>
              <th className="px-3 py-2 text-right">Costo Tributario</th>
              <th className="px-3 py-2 text-right">Costo IFRS</th>
              <th className="px-3 py-2 text-right">Dif. costo</th>
              <th className="px-3 py-2 text-right">Dep. acum. Tributario</th>
              <th className="px-3 py-2 text-right">Dep. acum. IFRS</th>
              <th className="px-3 py-2 text-right">Dif. dep.</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-2 text-sm text-muted-foreground">Sin activos para este año.</td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.activoId} className="border-t">
                <td className="px-3 py-1.5">
                  <span className="font-mono text-muted-foreground">{f.codigo}</span> {f.descripcion}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.costoTributario)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.costoIfrs)}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${f.difCosto !== 0 ? "font-medium" : ""}`}>{fmt(f.difCosto)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.depTributario)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(f.depIfrs)}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${f.difDep !== 0 ? "font-medium" : ""}`}>{fmt(f.difDep)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
