import { listarBancos, listarFormatosCartola } from "@erp/db";
import { CartolasFormatosManager } from "@/components/panel/cartolas-formatos-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function CartolasFormatosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [formatos, bancos] = await Promise.all([listarFormatosCartola(empresaId), listarBancos()]);
  return (
    <>
      <TypographyHeading
        title="Formatos de cartola"
        description="Plantillas de mapeo por banco: qué columna o posición de cada archivo corresponde a fecha, descripción, monto, etc."
      />
      <CartolasFormatosManager empresaId={empresaId} formatos={formatos} bancos={bancos.map((b) => ({ id: b.id, label: b.nombre }))} />
    </>
  );
}
