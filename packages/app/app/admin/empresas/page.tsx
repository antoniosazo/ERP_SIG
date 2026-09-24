import { redirect } from "next/navigation";
import { listarEmpresasDeFirma } from "@erp/db";
import { obtenerSesion } from "@/lib/auth-helpers";
import { EmpresasGrid } from "@/components/empresas-grid";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const session = await obtenerSesion();
  if (!session?.user) redirect("/login");

  const todasLasEmpresas = await listarEmpresasDeFirma(session.user.firmaContableId);

  // Administrador de la firma ve toda la cartera; el resto solo las empresas que tiene asignadas.
  const empresas = session.user.esAdminFirma
    ? todasLasEmpresas
    : todasLasEmpresas.filter((e) =>
        session.user.empresas.some((asignacion) => asignacion.empresaId === e.id),
      );

  // Sin dato real de "último acceso" todavía (no hay tracking en la base) — null lo oculta en la tarjeta.
  const filas = empresas.map((e) => ({ ...e, ultimoAcceso: null }));

  return <EmpresasGrid empresas={filas} puedeCrear={session.user.esAdminFirma} />;
}
