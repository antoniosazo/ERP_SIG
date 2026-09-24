import Link from "next/link";
import { db, listarPlanCuentasDeEmpresa, obtenerCierreConAsiento, resolverCuentaGeneral } from "@erp/db";
import { AsientoTabla } from "@/components/panel/asiento-tabla";
import { CerrarEjercicioBoton, ReabrirEjercicioBoton } from "@/components/panel/cierre-ejercicio-botones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("es-CL");

export default async function CierreEjercicioPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ anio?: string }>;
}) {
  const { empresaId } = await params;
  const sp = await searchParams;
  const anio = Number.isInteger(Number(sp.anio)) && sp.anio ? Number(sp.anio) : new Date().getFullYear();

  const [estado, plan, cuentaSugeridaId] = await Promise.all([
    obtenerCierreConAsiento(empresaId, anio),
    listarPlanCuentasDeEmpresa(empresaId),
    resolverCuentaGeneral(db, empresaId, "general", "resultado_ejercicio"),
  ]);
  const cuentasPatrimonio = plan
    .filter((c) => c.nivelImputable && c.activa && c.clase === "Patrimonio")
    .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }));

  const cerrado = estado.cierre?.estado === "contabilizado";
  const cuentaResultado = estado.cierre ? plan.find((c) => c.id === estado.cierre!.cuentaResultadoId) : undefined;

  return (
    <>
      <TypographyHeading
        title="Cierre de ejercicio"
        description="Deja en cero las cuentas de Ingresos y Costos y Gastos del año y traspasa el resultado a Patrimonio. Solo Administrador. Requiere los 12 meses del año bloqueados y el ejercicio anterior ya cerrado."
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="anio" className="text-xs text-muted-foreground">
            Año
          </label>
          <Input id="anio" name="anio" type="number" defaultValue={anio} className="h-8 w-28" />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Ver
        </Button>
        <div className="ml-auto flex gap-1 text-xs">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/panel/${empresaId}/configuracion/determinacion-cuentas`}>
              Configurar cuenta de resultado por defecto
            </Link>
          </Button>
        </div>
      </form>

      {cerrado ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Cerrado</Badge>
          <span className="text-sm text-muted-foreground">
            Resultado {fmt(estado.cierre!.montoResultado)} → {cuentaResultado?.codigoCuenta} {cuentaResultado?.nombreCuenta}
          </span>
          <ReabrirEjercicioBoton empresaId={empresaId} anio={anio} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">No cerrado</Badge>
          {estado.cierre?.estado === "anulado" && (
            <span className="text-sm text-muted-foreground">
              Se reabrió el {estado.cierre.fechaReapertura} (motivo: {estado.cierre.motivoReapertura})
            </span>
          )}
        </div>
      )}

      {estado.bloqueos.length > 0 && (
        <Card>
          <CardContent className="space-y-1 pt-6 text-sm">
            <p className="font-medium">No se puede cerrar todavía:</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {estado.bloqueos.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Ingresos {anio}</div>
            <div className="text-lg font-semibold tabular-nums">{fmt(estado.totalIngresos)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Costos y gastos {anio}</div>
            <div className="text-lg font-semibold tabular-nums">{fmt(estado.totalGastos)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">
              {estado.resultado >= 0 ? "Utilidad" : "Pérdida"} del ejercicio
            </div>
            <div className={`text-lg font-semibold tabular-nums ${estado.resultado < 0 ? "text-destructive" : ""}`}>
              {fmt(Math.abs(estado.resultado))}
            </div>
          </CardContent>
        </Card>
      </div>

      {estado.lineas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuentas que se dejarían en cero</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Clase</TableHead>
                  <TableHead className="text-right">Saldo del año</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estado.lineas.map((l) => (
                  <TableRow key={l.cuentaId}>
                    <TableCell className="font-mono text-muted-foreground">{l.codigo}</TableCell>
                    <TableCell>{l.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{l.clase}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(l.saldo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!cerrado && estado.bloqueos.length === 0 && estado.lineas.length > 0 && (
        <CerrarEjercicioBoton
          empresaId={empresaId}
          anio={anio}
          cuentas={cuentasPatrimonio}
          cuentaSugeridaId={cuentaSugeridaId}
        />
      )}

      {estado.asiento && <AsientoTabla a={estado.asiento} titulo="Asiento de cierre" />}
      {estado.reversa && <AsientoTabla a={estado.reversa} titulo="Asiento de reapertura (reversa)" />}
    </>
  );
}
