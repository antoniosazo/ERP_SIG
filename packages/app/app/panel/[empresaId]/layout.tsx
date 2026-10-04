import { notFound } from "next/navigation";
import { listarEmpresas, listarMonedasDeEmpresa, periodoDe } from "@erp/db";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { leerColorScheme } from "@/lib/color-scheme";
import { MobileTabBar } from "@/components/panel/mobile-tab-bar";
import { ContextoFirmaBanner } from "@/components/contexto-firma-banner";
import { MobileTopBar } from "@/components/panel/mobile-top-bar";
import { PanelHeader } from "@/components/panel/panel-header";
import { PanelShell } from "@/components/panel/panel-shell";
import { PanelSidebar } from "@/components/panel/panel-sidebar";

const MESES_ABREV = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const ESTADO_PERIODO: Record<string, string> = {
  Desbloqueado: "Abierto",
  "Período de cierre": "En cierre",
  Bloqueado: "Bloqueado",
  "Bloqueado excepto ventas": "Bloq. excepto ventas",
};

export default async function PanelEmpresaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();

  const { empresa, rol, session } = acceso;
  const hoy = new Date().toISOString().slice(0, 10);
  const [scheme, monedas, todasLasEmpresas, periodo] = await Promise.all([
    leerColorScheme(),
    listarMonedasDeEmpresa(empresaId).catch(() => []),
    listarEmpresas(),
    periodoDe(empresaId, hoy).catch(() => null),
  ]);
  const monedaFuncional =
    monedas.find((m) => m.id === empresa.monedaFuncionalId)?.codigo ?? null;
  const rolTxt = session.user.firmaVistaNombre ? "Superadmin" : rol ?? (session.user.esAdminFirma ? "Admin firma" : null);
  const periodoLabel = periodo
    ? `${MESES_ABREV[periodo.mes - 1]} ${periodo.anio} · ${ESTADO_PERIODO[periodo.estado] ?? periodo.estado}`
    : null;
  const periodoAbierto = periodo?.estado === "Desbloqueado";

  // Mismo criterio que /admin/empresas: admin de firma ve toda la cartera, el resto solo lo asignado.
  const empresasVisibles = session.user.esAdminFirma
    ? todasLasEmpresas
    : todasLasEmpresas.filter((e) =>
        session.user.empresas.some((asignacion) => asignacion.empresaId === e.id),
      );

  return (
    <PanelShell
      empresaId={empresaId}
      menuBar={
        <PanelHeader
          empresaId={empresaId}
          empresas={empresasVisibles}
          empresaActual={{ id: empresaId, razonSocial: empresa.razonSocial, rut: empresa.rut }}
          periodoLabel={periodoLabel}
          periodoAbierto={periodoAbierto}
          monedaFuncional={monedaFuncional}
          userName={session.user.name ?? "—"}
          rolLabel={rolTxt}
          scheme={scheme}
          puedeVerFirma={session.user.esAdminFirma}
          puedeCambiarFirma={session.user.firmas.length > 1 && !session.user.esSuperAdmin}
        />
      }
      sidebar={<PanelSidebar empresaId={empresaId} />}
      mobileTopBar={
        <MobileTopBar razonSocial={empresa.razonSocial} userName={session.user.name ?? "—"} scheme={scheme} />
      }
      mobileTabBar={<MobileTabBar empresaId={empresaId} razonSocial={empresa.razonSocial} />}
      contextoFirma={session.user.firmaVistaNombre ? <ContextoFirmaBanner nombre={session.user.firmaVistaNombre} /> : null}
    >
      {children}
    </PanelShell>
  );
}
