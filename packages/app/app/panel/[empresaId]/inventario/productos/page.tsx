import { listarProductos, listarProductosGrupos } from "@erp/db";
import { ProductosManager } from "@/components/panel/productos-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function ProductosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [productos, grupos] = await Promise.all([
    listarProductos(empresaId),
    listarProductosGrupos(empresaId),
  ]);
  const grupoNombre = new Map(grupos.map((g) => [g.id, g.nombre]));

  return (
    <>
      <TypographyHeading
        title="Productos"
        description="Catálogo de productos/servicios. La imputación contable la define el grupo (Inventario → Grupos de artículos)."
      />
      <ProductosManager
        empresaId={empresaId}
        productos={productos.map((p) => ({
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          tipo: p.tipo,
          estado: p.estado,
          grupoId: p.grupoId,
          grupoNombre: grupoNombre.get(p.grupoId) ?? "—",
          precioUnitario: Number(p.precioUnitario),
          unidadMedida: p.unidadMedida,
          codigoBarras: p.codigoBarras,
          glosaSugerida: p.glosaSugerida,
          esVenta: p.esVenta,
          esCompra: p.esCompra,
          esInventario: p.esInventario,
          metodoValoracion: p.metodoValoracion,
          costoEstandar: Number(p.costoEstandar),
        }))}
        grupos={grupos.map((g) => ({ id: g.id, label: g.nombre }))}
      />
    </>
  );
}
