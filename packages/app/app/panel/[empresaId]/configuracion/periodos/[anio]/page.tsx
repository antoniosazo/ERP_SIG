import Link from "next/link";
import { notFound } from "next/navigation";
import { listarPeriodos } from "@erp/db";
import { GenerarEjercicioForm } from "@/components/panel/generar-ejercicio-form";
import { PeriodosMesTable } from "@/components/panel/periodos-mes-table";
import { Button } from "@/components/ui/button";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function EjercicioPage({
  params,
}: {
  params: Promise<{ empresaId: string; anio: string }>;
}) {
  const { empresaId, anio } = await params;
  const anioNum = Number(anio);
  if (!Number.isInteger(anioNum)) notFound();

  const delAnio = (await listarPeriodos(empresaId)).filter((p) => p.anio === anioNum);
  if (delAnio.length === 0) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TypographyHeading
          title={`Ejercicio ${anioNum}`}
          description={`${delAnio.length}/12 meses. Los cierres son secuenciales; reabrir un mes cerrado exige motivo y rol Administrador.`}
        />
        <Button asChild variant="outline" size="sm">
          <Link href={`/panel/${empresaId}/configuracion/periodos`}>← Períodos contables</Link>
        </Button>
      </div>

      {delAnio.length < 12 && (
        <GenerarEjercicioForm
          empresaId={empresaId}
          anioInicial={anioNum}
          label={`Completar ejercicio ${anioNum}`}
        />
      )}

      <PeriodosMesTable
        empresaId={empresaId}
        periodos={delAnio.map((p) => ({
          id: p.id,
          anio: p.anio,
          mes: p.mes,
          fechaInicio: p.fechaInicio,
          fechaFin: p.fechaFin,
          estado: p.estado,
          fechaCierre: p.fechaCierre ? p.fechaCierre.toISOString() : null,
          motivoReapertura: p.motivoReapertura,
        }))}
      />
    </>
  );
}
