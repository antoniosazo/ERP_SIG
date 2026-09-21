import Link from "next/link";
import { notFound } from "next/navigation";
import { movimientosCuenta, type MovimientoMayor } from "@erp/db";
import { FilaEnlace } from "@/components/panel/fila-enlace";
import { FlechaDetalle } from "@/components/panel/flecha-detalle";
import { ETIQUETA_ORIGEN, rutaOrigen } from "@/lib/origen-asiento";
import { VolverBoton } from "@/components/panel/volver-boton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const esFecha = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const fmt = (n: number) => n.toLocaleString("es-CL");

export default async function LibroMayorPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string; cuentaId: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { empresaId, cuentaId } = await params;
  const sp = await searchParams;
  const hoy = new Date().toISOString().slice(0, 10);
  const hasta = esFecha(sp.hasta) ? sp.hasta : hoy;
  const desde = esFecha(sp.desde) ? sp.desde : `${hasta.slice(0, 4)}-01-01`;

  const r = await movimientosCuenta(empresaId, cuentaId, desde, hasta);
  if (!r) notFound();
  const { cuenta } = r;
  // Saldo acumulado línea a línea, calculado antes de dibujar la tabla.
  const filas = r.movimientos.reduce<{ m: MovimientoMayor; acumulado: number }[]>((acc, m) => {
    const previo = acc.length ? acc[acc.length - 1]!.acumulado : r.saldoInicial;
    acc.push({ m, acumulado: Math.round((previo + m.debe - m.haber) * 100) / 100 });
    return acc;
  }, []);

  return (
    <>
      <VolverBoton fallbackHref={`/panel/${empresaId}/configuracion/plan-cuentas?hasta=${hasta}`} />
      <TypographyHeading
        title={`Libro mayor · ${cuenta.codigoCuenta} ${cuenta.nombreCuenta}`}
        description={`${cuenta.clase} · naturaleza ${cuenta.naturaleza.toLowerCase()}${r.incluyeHijas ? " · incluye las cuentas hijas" : ""}. Saldo = debe − haber: un saldo acreedor aparece en negativo. Solo asientos contabilizados, en moneda funcional.`}
      />

      <form className="flex flex-wrap items-end gap-3" method="get">
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
        {r.reinicioAnual && (
          <Badge variant="outline">Cuenta de resultado: el saldo parte en enero de {desde.slice(0, 4)}</Badge>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Saldo inicial", r.saldoInicial],
          ["Total debe", r.totalDebe],
          ["Total haber", r.totalHaber],
          ["Saldo final", r.saldoFinal],
        ].map(([etiqueta, valor]) => (
          <Card key={etiqueta as string}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">{etiqueta as string}</div>
              <div className={`text-lg font-semibold tabular-nums ${(valor as number) < 0 ? "text-destructive" : ""}`}>
                {fmt(valor as number)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {r.movimientos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos en el período seleccionado.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-20">Asiento</TableHead>
                {r.incluyeHijas && <TableHead>Cuenta</TableHead>}
                <TableHead>Glosa</TableHead>
                <TableHead>Tercero</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40">
                <TableCell colSpan={r.incluyeHijas ? 8 : 7} className="text-muted-foreground">
                  Saldo inicial al {desde}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${r.saldoInicial < 0 ? "text-destructive" : ""}`}>{fmt(r.saldoInicial)}</TableCell>
                <TableCell />
              </TableRow>
              {filas.map(({ m, acumulado }) => {
                const ruta = rutaOrigen(empresaId, m);
                return (
                  <FilaEnlace key={m.lineaId} href={ruta} title="Ir al documento">
                    <TableCell className="tabular-nums text-muted-foreground">{m.fecha}</TableCell>
                    <TableCell className="font-mono">{m.correlativo}</TableCell>
                    {r.incluyeHijas && (
                      <TableCell className="whitespace-nowrap">
                        <span className="font-mono text-muted-foreground">{m.cuentaCodigo}</span> {m.cuentaNombre}
                      </TableCell>
                    )}
                    <TableCell>{m.glosaLinea || m.glosaAsiento}</TableCell>
                    <TableCell className="text-muted-foreground">{m.tercero ?? "—"}</TableCell>
                    <TableCell>
                      {ruta ? (
                        <Link href={ruta} className="hover:underline">
                          {ETIQUETA_ORIGEN[m.origenTabla ?? ""] ?? m.origenTabla}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{m.origenTabla ? (ETIQUETA_ORIGEN[m.origenTabla] ?? m.origenTabla) : "Manual"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.debe ? fmt(m.debe) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.haber ? fmt(m.haber) : ""}</TableCell>
                    <TableCell className={`text-right tabular-nums ${acumulado < 0 ? "text-destructive" : ""}`}>
                      {fmt(acumulado)}
                    </TableCell>
                    <TableCell className="text-right">
                      {ruta && <FlechaDetalle href={ruta} title="Ir al documento" />}
                    </TableCell>
                  </FilaEnlace>
                );
              })}
              <TableRow className="border-t-2 font-medium">
                <TableCell colSpan={r.incluyeHijas ? 6 : 5}>Totales del período</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.totalDebe)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.totalHaber)}</TableCell>
                <TableCell className={`text-right tabular-nums ${r.saldoFinal < 0 ? "text-destructive" : ""}`}>{fmt(r.saldoFinal)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
