import Link from "next/link";
import { balanceOchoColumnas } from "@erp/db";
import { FlechaDetalle } from "@/components/panel/flecha-detalle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const esFecha = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (n: number) => (Math.abs(n) < 0.005 ? "" : n.toLocaleString("es-CL"));

export default async function BalancePage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ hasta?: string; vista?: string }>;
}) {
  const { empresaId } = await params;
  const sp = await searchParams;
  const hasta = esFecha(sp.hasta) ? sp.hasta : new Date().toISOString().slice(0, 10);
  const completo = sp.vista !== "comprobacion";
  const b = await balanceOchoColumnas(empresaId, hasta);
  const base = `/panel/${empresaId}/informes/balance`;
  const enlaceVista = (v: string) => `${base}?hasta=${hasta}&vista=${v}`;
  const todoCuadra = Object.values(b.cuadra).every(Boolean);

  const cab = "text-right whitespace-nowrap";
  const grupo = "border-l text-center";
  const colspanCuenta = 3;

  return (
    <>
      <TypographyHeading
        title={completo ? "Balance de 8 columnas" : "Balance de comprobación"}
        description={`Cuentas con movimiento al ${hasta}: sumas, saldos${completo ? ", inventario y resultados" : ""}. Solo asientos contabilizados, en moneda funcional. Las cuentas de resultado acumulan el ejercicio.`}
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="vista" value={completo ? "8columnas" : "comprobacion"} />
        <div className="space-y-1">
          <label htmlFor="hasta" className="text-xs text-muted-foreground">
            Al
          </label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} className="h-8 w-40" />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Consultar
        </Button>
        <div className="ml-auto flex gap-1">
          <Button asChild size="sm" variant={completo ? "default" : "outline"}>
            <Link href={enlaceVista("8columnas")}>8 columnas</Link>
          </Button>
          <Button asChild size="sm" variant={completo ? "outline" : "default"}>
            <Link href={enlaceVista("comprobacion")}>Comprobación</Link>
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={todoCuadra ? "default" : "destructive"}>{todoCuadra ? "Cuadra ✔" : "No cuadra ✘"}</Badge>
        <span className="text-muted-foreground">
          Sumas {b.cuadra.sumas ? "✔" : "✘"} · Saldos {b.cuadra.saldos ? "✔" : "✘"}
          {completo && <> · Inventario {b.cuadra.inventario ? "✔" : "✘"} · Resultados {b.cuadra.resultados ? "✔" : "✘"}</>}
        </span>
      </div>

      {b.filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay movimientos contabilizados a esa fecha.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead colSpan={colspanCuenta} />
                <TableHead colSpan={2} className={grupo}>
                  Sumas
                </TableHead>
                <TableHead colSpan={2} className={grupo}>
                  Saldos
                </TableHead>
                {completo && (
                  <>
                    <TableHead colSpan={2} className={grupo}>
                      Inventario
                    </TableHead>
                    <TableHead colSpan={2} className={grupo}>
                      Resultados
                    </TableHead>
                  </>
                )}
              </TableRow>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className={`${cab} border-l`}>Débitos</TableHead>
                <TableHead className={cab}>Créditos</TableHead>
                <TableHead className={`${cab} border-l`}>Deudor</TableHead>
                <TableHead className={cab}>Acreedor</TableHead>
                {completo && (
                  <>
                    <TableHead className={`${cab} border-l`}>Activo</TableHead>
                    <TableHead className={cab}>Pasivo</TableHead>
                    <TableHead className={`${cab} border-l`}>Pérdida</TableHead>
                    <TableHead className={cab}>Ganancia</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.filas.map((f) => (
                <TableRow key={f.cuentaId}>
                  <TableCell>
                    <FlechaDetalle
                      href={`/panel/${empresaId}/configuracion/plan-cuentas/${f.cuentaId}?hasta=${hasta}`}
                      title={`Libro mayor de ${f.codigo}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{f.codigo}</TableCell>
                  <TableCell>{f.nombre}</TableCell>
                  <TableCell className={`${cab} tabular-nums border-l`}>{num(f.debe)}</TableCell>
                  <TableCell className={`${cab} tabular-nums`}>{num(f.haber)}</TableCell>
                  <TableCell className={`${cab} tabular-nums border-l`}>{num(f.deudor)}</TableCell>
                  <TableCell className={`${cab} tabular-nums`}>{num(f.acreedor)}</TableCell>
                  {completo && (
                    <>
                      <TableCell className={`${cab} tabular-nums border-l`}>{num(f.activo)}</TableCell>
                      <TableCell className={`${cab} tabular-nums`}>{num(f.pasivo)}</TableCell>
                      <TableCell className={`${cab} tabular-nums border-l`}>{num(f.perdida)}</TableCell>
                      <TableCell className={`${cab} tabular-nums`}>{num(f.ganancia)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}

              <TableRow className="border-t-2 bg-muted/40 font-medium">
                <TableCell colSpan={colspanCuenta}>Totales</TableCell>
                <TableCell className={`${cab} tabular-nums border-l`}>{num(b.totales.debe)}</TableCell>
                <TableCell className={`${cab} tabular-nums`}>{num(b.totales.haber)}</TableCell>
                <TableCell className={`${cab} tabular-nums border-l`}>{num(b.totales.deudor)}</TableCell>
                <TableCell className={`${cab} tabular-nums`}>{num(b.totales.acreedor)}</TableCell>
                {completo && (
                  <>
                    <TableCell className={`${cab} tabular-nums border-l`}>{num(b.totales.activo)}</TableCell>
                    <TableCell className={`${cab} tabular-nums`}>{num(b.totales.pasivo)}</TableCell>
                    <TableCell className={`${cab} tabular-nums border-l`}>{num(b.totales.perdida)}</TableCell>
                    <TableCell className={`${cab} tabular-nums`}>{num(b.totales.ganancia)}</TableCell>
                  </>
                )}
              </TableRow>

              {completo && (
                <>
                  <TableRow>
                    <TableCell colSpan={colspanCuenta + 4}>
                      {b.resultadoEjercicio >= 0 ? "Utilidad del ejercicio" : "Pérdida del ejercicio"}
                    </TableCell>
                    <TableCell className={`${cab} tabular-nums border-l ${b.resultadoEjercicio < 0 ? "text-destructive" : ""}`}>
                      {b.resultadoEjercicio < 0 ? num(-b.resultadoEjercicio) : ""}
                    </TableCell>
                    <TableCell className={`${cab} tabular-nums`}>{b.resultadoEjercicio >= 0 ? num(b.resultadoEjercicio) : ""}</TableCell>
                    <TableCell className={`${cab} tabular-nums border-l`}>{b.resultadoEjercicio >= 0 ? num(b.resultadoEjercicio) : ""}</TableCell>
                    <TableCell className={`${cab} tabular-nums ${b.resultadoEjercicio < 0 ? "text-destructive" : ""}`}>
                      {b.resultadoEjercicio < 0 ? num(-b.resultadoEjercicio) : ""}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-t-2 font-medium">
                    <TableCell colSpan={colspanCuenta + 4}>Sumas iguales</TableCell>
                    <TableCell className={`${cab} tabular-nums border-l`}>{num(b.conResultado.activo)}</TableCell>
                    <TableCell className={`${cab} tabular-nums`}>{num(b.conResultado.pasivo)}</TableCell>
                    <TableCell className={`${cab} tabular-nums border-l`}>{num(b.conResultado.perdida)}</TableCell>
                    <TableCell className={`${cab} tabular-nums`}>{num(b.conResultado.ganancia)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
