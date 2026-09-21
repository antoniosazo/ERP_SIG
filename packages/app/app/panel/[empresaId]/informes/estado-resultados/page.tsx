import { estadoResultados, type FilaResultado } from "@erp/db";
import { FlechaDetalle } from "@/components/panel/flecha-detalle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const esFecha = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const fmt = (n: number) => n.toLocaleString("es-CL");

export default async function EstadoResultadosPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { empresaId } = await params;
  const sp = await searchParams;
  const hasta = esFecha(sp.hasta) ? sp.hasta : new Date().toISOString().slice(0, 10);
  const desde = esFecha(sp.desde) ? sp.desde : `${hasta.slice(0, 4)}-01-01`;
  const er = await estadoResultados(empresaId, desde, hasta);
  const ingresosTotal = er.ingresos.total;
  const pct = (n: number) => (ingresosTotal !== 0 ? `${((n / ingresosTotal) * 100).toFixed(1)}%` : "");

  const seccion = (titulo: string, filas: FilaResultado[], total: number) => (
    <>
      <tr className="bg-muted/40">
        <td colSpan={2} className="px-3 py-2 font-semibold">
          {titulo}
        </td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(total)}</td>
        <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{pct(total)}</td>
      </tr>
      {filas.length === 0 && (
        <tr>
          <td colSpan={4} className="px-3 py-2 text-sm text-muted-foreground">
            Sin movimientos en el período.
          </td>
        </tr>
      )}
      {filas.map((f) => (
        <tr key={f.cuentaId} className="border-t">
          <td className="w-10 px-3 py-1.5">
            {!f.esTitulo && (
              <FlechaDetalle
                href={`/panel/${empresaId}/configuracion/plan-cuentas/${f.cuentaId}?desde=${desde}&hasta=${hasta}`}
                title={`Libro mayor de ${f.codigo}`}
              />
            )}
          </td>
          <td className="px-3 py-1.5" style={{ paddingLeft: `${0.75 + f.nivel * 1.25}rem` }}>
            <span className="font-mono text-muted-foreground">{f.codigo}</span>{" "}
            <span className={f.esTitulo ? "font-medium" : undefined}>{f.nombre}</span>
          </td>
          <td className={`px-3 py-1.5 text-right tabular-nums ${f.esTitulo ? "font-medium" : ""}`}>{fmt(f.monto)}</td>
          <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{pct(f.monto)}</td>
        </tr>
      ))}
    </>
  );

  return (
    <>
      <TypographyHeading
        title="Estado de resultados"
        description="Ingresos, costos y gastos del período con el resultado. Solo asientos contabilizados, en moneda funcional."
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="desde" className="text-xs text-muted-foreground">
            Desde
          </label>
          <Input id="desde" name="desde" type="date" defaultValue={desde} className="h-8 w-40" />
        </div>
        <div className="space-y-1">
          <label htmlFor="hasta" className="text-xs text-muted-foreground">
            Hasta
          </label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="h-8 w-40" />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Consultar
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Ingresos", er.ingresos.total, false],
          ["Costos y gastos", er.gastos.total, false],
          [er.resultado >= 0 ? "Utilidad del período" : "Pérdida del período", er.resultado, er.resultado < 0],
        ].map(([etiqueta, valor, rojo]) => (
          <Card key={etiqueta as string}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">{etiqueta as string}</div>
              <div className={`text-lg font-semibold tabular-nums ${rojo ? "text-destructive" : ""}`}>{fmt(valor as number)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2">Cuenta</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-right">% s/ingresos</th>
            </tr>
          </thead>
          <tbody>
            {seccion("Ingresos", er.ingresos.filas, er.ingresos.total)}
            {seccion("Costos y gastos", er.gastos.filas, er.gastos.total)}
            <tr className="border-t-2 bg-muted/40 font-semibold">
              <td colSpan={2} className="px-3 py-2">
                {er.resultado >= 0 ? "Utilidad del período" : "Pérdida del período"}
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${er.resultado < 0 ? "text-destructive" : ""}`}>{fmt(er.resultado)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{pct(er.resultado)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
