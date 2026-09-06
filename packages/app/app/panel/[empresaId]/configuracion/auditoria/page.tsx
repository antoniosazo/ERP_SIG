import { notFound } from "next/navigation";
import { listarAuditoriaDeEmpresa, listarUsuariosDeAuditoria } from "@erp/db";
import type { AuditoriaAccion } from "@erp/shared";
import { AuditoriaTabla } from "@/components/panel/auditoria-tabla";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

export default async function AuditoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ tabla?: string; accion?: string; usuarioId?: string; pagina?: string }>;
}) {
  const { empresaId } = await params;
  const sp = await searchParams;

  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();
  // La auditoría es para Administrador y Contador; el Asistente no la ve.
  if (!acceso.session.user.esAdminFirma && acceso.rol !== "Administrador" && acceso.rol !== "Contador") {
    notFound();
  }

  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const [{ filas, total }, usuarios] = await Promise.all([
    listarAuditoriaDeEmpresa(empresaId, {
      tabla: sp.tabla || undefined,
      accion: (sp.accion as AuditoriaAccion) || undefined,
      usuarioId: sp.usuarioId || undefined,
      limite: POR_PAGINA,
      offset: (pagina - 1) * POR_PAGINA,
    }),
    listarUsuariosDeAuditoria(empresaId),
  ]);

  return (
    <>
      <TypographyHeading
        title="Auditoría"
        description="Registro de cambios en los maestros de la empresa (3.8). Solo lectura."
      />
      <AuditoriaTabla
        filas={filas.map((f) => ({
          id: f.id,
          creadoEn: f.creadoEn.toISOString(),
          usuarioNombre: f.usuarioNombre,
          usuarioId: f.usuarioId,
          tablaAfectada: f.tablaAfectada,
          etiqueta: f.etiqueta,
          accion: f.accion,
          motivo: f.motivo,
          valoresAnteriores: f.valoresAnteriores as Record<string, unknown> | null,
          valoresNuevos: f.valoresNuevos as Record<string, unknown> | null,
        }))}
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        filtros={{ tabla: sp.tabla ?? "", accion: sp.accion ?? "", usuarioId: sp.usuarioId ?? "" }}
        usuarios={usuarios
          .filter((u): u is { usuarioId: string; usuarioNombre: string } => u.usuarioId !== null)
          .map((u) => ({ id: u.usuarioId, nombre: u.usuarioNombre }))}
      />
    </>
  );
}
