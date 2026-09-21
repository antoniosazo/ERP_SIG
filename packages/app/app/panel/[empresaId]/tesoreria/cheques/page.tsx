import { ChequesPage } from "@/components/panel/cheques-pages";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { empresaId } = await params;
  const { estado } = await searchParams;
  return <ChequesPage empresaId={empresaId} estado={estado} />;
}
