import {
  listarCategorias,
  listarCentrosCosto,
  listarImpuestosDeEmpresa,
  listarPlanCuentasDeEmpresa,
  listarProductos,
  listarProductosGrupos,
} from "@erp/db";
import { ProductosManager } from "@/components/panel/productos-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function ProductosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [productos, grupos, cuentas, impuestos, centros, categorias] = await Promise.all([
    listarProductos(empresaId),
    listarProductosGrupos(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
    listarImpuestosDeEmpresa(empresaId),
    listarCentrosCosto(empresaId),
    listarCategorias(empresaId),
  ]);
  const grupoNombre = new Map(grupos.map((g) => [g.id, g.nombre]));

  return (
    <>
      <TypographyHeading
        title="Productos"
        description="Catálogo de productos/servicios. Plantilla de imputación contable para las líneas de documento (sin inventario)."
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
          cuentaIngresoId: p.cuentaIngresoId,
          impuestoId: p.impuestoId,
          centroCostoId: p.centroCostoId,
          categoriaContableId: p.categoriaContableId,
          cuentaInventarioId: p.cuentaInventarioId,
          cuentaCostoVentaId: p.cuentaCostoVentaId,
          cuentaGastoCompraId: p.cuentaGastoCompraId,
          impuestoCompraId: p.impuestoCompraId,
        }))}
        grupos={grupos.map((g) => ({ id: g.id, label: g.nombre }))}
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
