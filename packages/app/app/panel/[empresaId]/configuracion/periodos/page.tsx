import Link from "next/link";
import { listarPeriodos } from "@erp/db";
import { GenerarEjercicioForm } from "@/components/panel/generar-ejercicio-form";
import { badgeVariantPeriodo } from "@/components/panel/periodos-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function PeriodosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const periodos = await listarPeriodos(empresaId);

  const porAnio = new Map<number, { total: number; estados: Map<string, number> }>();
  for (const p of periodos) {
    const e = porAnio.get(p.anio) ?? { total: 0, estados: new Map() };
    e.total += 1;
    e.estados.set(p.estado, (e.estados.get(p.estado) ?? 0) + 1);
    porAnio.set(p.anio, e);
  }
  const anios = [...porAnio.entries()].sort((a, b) => b[0] - a[0]);

  return (
    <>
      <TypographyHeading
        title="Períodos contables"
        description="Ejercicios generados por empresa. Entra a un año para ver sus meses y cambiar los estados (3.12)."
      />

      <GenerarEjercicioForm empresaId={empresaId} />

      {anios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta empresa aún no tiene periodos contables. Genera un ejercicio para empezar.
        </p>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Ejercicio</TableHead>
                <TableHead className="w-24">Meses</TableHead>
                <TableHead>Estados</TableHead>
                <TableHead className="w-28 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anios.map(([anio, info]) => (
                <TableRow key={anio}>
                  <TableCell className="font-mono font-medium">
                    <Link
                      href={`/panel/${empresaId}/configuracion/periodos/${anio}`}
                      className="hover:underline"
                    >
                      {anio}
                    </Link>
                  </TableCell>
                  <TableCell className={info.total < 12 ? "text-destructive" : "text-muted-foreground"}>
                    {info.total}/12
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {[...info.estados.entries()].map(([estado, n]) => (
                        <Badge key={estado} variant={badgeVariantPeriodo(estado)}>
                          {n} {estado}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/panel/${empresaId}/configuracion/periodos/${anio}`}>
                        Abrir →
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
