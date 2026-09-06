import { listarCategorias, listarCentrosCosto, listarPlanCuentasDeEmpresa } from "@erp/db";
import { CategoriasManager } from "@/components/panel/categorias-manager";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function CategoriasPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const [categorias, cuentas, centros] = await Promise.all([
    listarCategorias(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
    listarCentrosCosto(empresaId),
  ]);

  const cuentaOpts = cuentas
    .filter((c) => c.nivelImputable && c.activa)
    .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }));
  const centroOpts = centros
    .filter((c) => c.estado === "Activo")
    .map((c) => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` }));

  return (
    <>
      <TypographyHeading
        title="Categorías contables"
        description="Determinación automática de cuentas: qué cuenta de gasto/ingreso/costo/activo usar según la categoría del tercero (3.11)."
      />
      <CategoriasManager
        empresaId={empresaId}
        cuentas={cuentaOpts}
        centrosCosto={centroOpts}
        categorias={categorias.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          aplicaA: c.aplicaA,
          cuentaGastoId: c.cuentaGastoId,
          cuentaIngresoId: c.cuentaIngresoId,
          cuentaCostoId: c.cuentaCostoId,
          cuentaActivoId: c.cuentaActivoId,
          centroCostoDefaultId: c.centroCostoDefaultId,
          ivaRecuperableDefault: c.ivaRecuperableDefault,
        }))}
      />
    </>
  );
}
