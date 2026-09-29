import { PagoNuevoPage } from "@/components/panel/pagos-pages";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ terceroId?: string; documentoId?: string }>;
}) {
  const [{ empresaId }, filtros] = await Promise.all([params, searchParams]);
  return (
    <PagoNuevoPage
      empresaId={empresaId}
      tipo="Efectuado"
      terceroInicialId={filtros.terceroId}
      documentoInicialId={filtros.documentoId}
    />
  );
}
