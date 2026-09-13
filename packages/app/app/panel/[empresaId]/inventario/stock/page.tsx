import { listarStockDeEmpresa } from "@erp/db";
import { StockLista } from "@/components/panel/stock-lista";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function StockPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const filas = await listarStockDeEmpresa(empresaId);

  return (
    <>
      <TypographyHeading
        title="Existencias"
        description="Saldo de inventario por producto (un almacén implícito por empresa), valorado a promedio ponderado móvil."
      />
      {filas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay movimientos de stock.</p>
      ) : (
        <StockLista
          empresaId={empresaId}
          filas={filas.map((f) => ({
            productoId: f.productoId,
            codigo: f.codigo,
            nombre: f.nombre,
            grupoId: f.grupoId,
            grupoNombre: f.grupoNombre,
            cantidad: Number(f.cantidad),
            costoPromedio: Number(f.costoPromedio),
            valor: Number(f.valor),
          }))}
        />
      )}
    </>
  );
}
