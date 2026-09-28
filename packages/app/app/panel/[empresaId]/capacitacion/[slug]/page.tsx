import { notFound } from "next/navigation";
import { buscarCapacitacionDoc } from "@/lib/capacitacion-docs";
import { PageHeader } from "@/components/ui/page-header";
import { ActivoFijoGuia } from "@/components/panel/capacitacion/activo-fijo-guia";
import { BancosGuia } from "@/components/panel/capacitacion/bancos-guia";
import { SiiGuia } from "@/components/panel/capacitacion/sii-guia";

export default async function CapacitacionDocPage({
  params,
}: {
  params: Promise<{ empresaId: string; slug: string }>;
}) {
  const { empresaId, slug } = await params;
  const doc = buscarCapacitacionDoc(slug);
  if (!doc) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Capacitación", href: `/panel/${empresaId}/capacitacion` },
          { label: doc.titulo },
        ]}
        title={doc.titulo}
        description={doc.descripcion}
      />

      {doc.slug === "bancos" ? (
        <BancosGuia empresaId={empresaId} />
      ) : doc.slug === "sii" ? (
        <SiiGuia empresaId={empresaId} />
      ) : (
        <ActivoFijoGuia empresaId={empresaId} />
      )}
    </>
  );
}
