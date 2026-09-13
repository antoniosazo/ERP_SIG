import { listarCategorias, listarGruposTercero, listarPlanCuentasDeEmpresa } from "@erp/db";
import { GruposTercerosManager } from "@/components/panel/grupos-terceros-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function GruposTercerosPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [grupos, cuentas, categorias] = await Promise.all([
    listarGruposTercero(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
    listarCategorias(empresaId),
  ]);

  return (
    <>
      <TypographyHeading
        title="Grupos de socios"
        description="Segmentación de clientes y proveedores, con cuenta puente y categoría contable por defecto (nivel intermedio de Determinación de cuentas). Se asigna en la ficha del socio."
      />
      <GruposTercerosManager
        empresaId={empresaId}
        grupos={grupos.map((g) => ({
          id: g.id,
          codigo: g.codigo,
          nombre: g.nombre,
          cuentaContableAsociadaId: g.cuentaContableAsociadaId,
          categoriaContableDefaultId: g.categoriaContableDefaultId,
        }))}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
        categorias={categorias.map((c) => ({ id: c.id, label: c.nombre }))}
      />
    </>
  );
}
