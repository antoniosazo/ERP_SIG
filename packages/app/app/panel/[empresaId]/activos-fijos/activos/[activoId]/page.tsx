import { notFound } from "next/navigation";
import {
  listarCentrosCosto,
  listarClasesActivoFijo,
  listarPeriodos,
  listarPlanCuentasDeEmpresa,
  listarVidasUtilesSii,
  obtenerActivoFijoConDetalle,
} from "@erp/db";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { MapaRelacionesDialog } from "@/components/panel/mapa-relaciones-dialog";
import { puedeEditarFinanzas } from "@erp/shared";
import { ActivoFijoFicha } from "@/components/panel/activo-fijo-ficha";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function ActivoFijoFichaPage({
  params,
}: {
  params: Promise<{ empresaId: string; activoId: string }>;
}) {
  const { empresaId, activoId } = await params;
  const [detalle, clases, centros, cuentas, periodos, vidasUtilesSii] = await Promise.all([
    obtenerActivoFijoConDetalle(activoId, empresaId),
    listarClasesActivoFijo(empresaId),
    listarCentrosCosto(empresaId),
    listarPlanCuentasDeEmpresa(empresaId),
    listarPeriodos(empresaId),
    listarVidasUtilesSii(empresaId),
  ]);
  if (!detalle) notFound();
  const acceso = await obtenerAccesoEmpresa(empresaId);

  return (
    <>
      <TypographyHeading title={detalle.activo.descripcion} description={`Activo ${detalle.activo.codigo}`} />
      {acceso && puedeEditarFinanzas(acceso.session.user.esAdminFirma, acceso.rol) && (
        <div><MapaRelacionesDialog empresaId={empresaId} tabla="activos_fijos" id={activoId} /></div>
      )}
      <ActivoFijoFicha
        empresaId={empresaId}
        detalle={detalle}
        clases={clases.filter((c) => c.activa).map((c) => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` }))}
        centros={centros
          .filter((c) => c.estado === "Activo")
          .map((c) => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` }))}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
        periodos={periodos.map((p) => ({ id: p.id, anio: p.anio, mes: p.mes, estado: p.estado }))}
        vidasUtilesSii={vidasUtilesSii
          .filter((v) => v.activa)
          .map((v) => ({ id: v.id, categoria: v.categoria, vidaUtilNormalMeses: v.vidaUtilNormalMeses }))}
      />
    </>
  );
}
