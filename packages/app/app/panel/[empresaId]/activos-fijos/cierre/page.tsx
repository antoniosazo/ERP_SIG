import { estadoCierreActivoFijo } from "@erp/db";
import { LIBRO_CONTABLE, type LibroContable } from "@erp/shared";
import { CerrarEjercicioActivoFijoBoton, ReabrirEjercicioActivoFijoBoton } from "@/components/panel/cierre-activo-fijo-botones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default async function CierreActivoFijoPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ anio?: string; libro?: string }>;
}) {
  const { empresaId } = await params;
  const sp = await searchParams;
  const anio = Number.isInteger(Number(sp.anio)) && sp.anio ? Number(sp.anio) : new Date().getFullYear();
  const libro: LibroContable = (LIBRO_CONTABLE as readonly string[]).includes(sp.libro ?? "")
    ? (sp.libro as LibroContable)
    : "Ambos";

  const estado = await estadoCierreActivoFijo(empresaId, libro, anio);
  const cerrado = estado.cierre?.estado === "contabilizado";

  return (
    <>
      <TypographyHeading
        title="Cierre de ejercicio — Activo Fijo"
        description="Congela el costo y la depreciación acumulada de cada activo al cierre del año. No genera asiento propio (el movimiento de dinero ya se contabilizó mes a mes vía capitalización, mejoras, depreciación y bajas). Requiere los 12 meses del año bloqueados y la depreciación de diciembre ejecutada."
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
          Ver
        </Button>
      </form>

      {cerrado ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Cerrado</Badge>
          <ReabrirEjercicioActivoFijoBoton empresaId={empresaId} libro={libro} anio={anio} />
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

      {!cerrado && estado.bloqueos.length === 0 && (
        <CerrarEjercicioActivoFijoBoton empresaId={empresaId} libro={libro} anio={anio} />
      )}
    </>
  );
}
