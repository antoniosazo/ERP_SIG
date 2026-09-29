import { AsientoNuevoPage } from "@/components/panel/asientos-pages";

export const dynamic = "force-dynamic";

const esUuid = (v: string | string[] | undefined): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ desde?: string | string[] }>;
}) {
  const [{ empresaId }, sp] = await Promise.all([params, searchParams]);
  return <AsientoNuevoPage empresaId={empresaId} desdeId={esUuid(sp.desde) ? sp.desde : undefined} />;
}
