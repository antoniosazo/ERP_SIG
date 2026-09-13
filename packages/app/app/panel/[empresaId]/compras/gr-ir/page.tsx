import { listarEntradasPendientesFacturar, listarTerceros } from "@erp/db";
import { GrIrLista } from "@/components/panel/gr-ir-lista";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function ConciliacionGrIrPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [entradas, terceros] = await Promise.all([
    listarEntradasPendientesFacturar(empresaId),
    listarTerceros(empresaId),
  ]);
  const provNombre = new Map(terceros.map((t) => [t.id, t.razonSocial]));

  return (
    <>
      <TypographyHeading
        title="Conciliación GR-IR"
        description="Entradas de mercadería contabilizadas y aún no facturadas. El total es el saldo vivo de la cuenta puente GR-IR y debe cuadrar contra el mayor."
      />
      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay recepciones pendientes de facturar.</p>
      ) : (
        <GrIrLista
          empresaId={empresaId}
          entradas={entradas.map((e) => ({
            id: e.id,
            numeroInterno: e.numeroInterno,
            terceroId: e.terceroId,
            proveedor: provNombre.get(e.terceroId) ?? "—",
            fechaEmision: e.fechaEmision,
            valorPendiente: e.valorPendiente,
          }))}
        />
      )}
    </>
  );
}
