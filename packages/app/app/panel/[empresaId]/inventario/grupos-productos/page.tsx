import {
  listarCategorias,
  listarCentrosCosto,
  listarImpuestosDeEmpresa,
  listarPlanCuentasDeEmpresa,
  listarProductosGrupos,
} from "@erp/db";
import { ProductosGruposManager } from "@/components/panel/productos-grupos-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function GruposProductosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [grupos, cuentas, impuestos, centros, categorias] = await Promise.all([
    listarProductosGrupos(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
    listarImpuestosDeEmpresa(empresaId),
    listarCentrosCosto(empresaId),
    listarCategorias(empresaId),
  ]);

  return (
    <>
      <TypographyHeading
        title="Grupos de artículos"
        description="Determinación de cuentas por defecto: los productos del grupo heredan estos valores."
      />
      <ProductosGruposManager
        empresaId={empresaId}
        grupos={grupos.map((g) => ({
          id: g.id,
          nombre: g.nombre,
          cuentaIngresoDefaultId: g.cuentaIngresoDefaultId,
          impuestoDefaultId: g.impuestoDefaultId,
          centroCostoDefaultId: g.centroCostoDefaultId,
          categoriaContableDefaultId: g.categoriaContableDefaultId,
          cuentaInventarioDefaultId: g.cuentaInventarioDefaultId,
          cuentaCostoVentaDefaultId: g.cuentaCostoVentaDefaultId,
          cuentaGastoCompraDefaultId: g.cuentaGastoCompraDefaultId,
          impuestoCompraDefaultId: g.impuestoCompraDefaultId,
        }))}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
        impuestos={impuestos
          .filter((i) => i.activo && (i.aplicaA === "Venta" || i.aplicaA === "Ambos"))
          .map((i) => ({ id: i.id, label: `${i.codigo} — ${i.nombre}` }))}
        centrosCosto={centros
          .filter((c) => c.estado === "Activo")
          .map((c) => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` }))}
        categorias={categorias.map((c) => ({ id: c.id, label: c.nombre }))}
      />
    </>
  );
}
