import { notFound } from "next/navigation";
import { listarMonedasDeEmpresa } from "@erp/db";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { leerUiTheme } from "@/lib/ui-theme";
import { MenuBar } from "@/components/panel/menu-bar";
import { PanelShell } from "@/components/panel/panel-shell";
import { PanelSidebar } from "@/components/panel/panel-sidebar";
import { StatusBar } from "@/components/panel/status-bar";

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
  const [ui, monedas] = await Promise.all([
    leerUiTheme(),
    listarMonedasDeEmpresa(empresaId).catch(() => []),
  ]);
  const monedaFuncional =
    monedas.find((m) => m.id === empresa.monedaFuncionalId)?.codigo ?? null;
  const rolTxt = rol ?? (session.user.esAdminFirma ? "Admin firma" : null);

  return (
    <PanelShell
      menuBar={
        <MenuBar
          empresaId={empresaId}
          razonSocial={empresa.razonSocial}
          rut={empresa.rut}
          userName={session.user.name ?? "—"}
          ui={ui}
        />
      }
      sidebar={<PanelSidebar empresaId={empresaId} />}
      statusBar={
        <StatusBar
          empresaId={empresaId}
          razonSocial={empresa.razonSocial}
          monedaFuncional={monedaFuncional}
          userName={session.user.name ?? "—"}
          rol={rolTxt}
        />
      }
    >
      {children}
    </PanelShell>
  );
}
