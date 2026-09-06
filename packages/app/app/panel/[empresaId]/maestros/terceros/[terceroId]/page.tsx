import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listarBancos,
  listarCategorias,
  listarGruposTercero,
  listarImpuestosDeEmpresa,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  obtenerTerceroConDetalle,
} from "@erp/db";
import { TerceroContactos } from "@/components/panel/tercero-contactos";
import { TerceroCuentasBancarias } from "@/components/panel/tercero-cuentas-bancarias";
import { TerceroDirecciones } from "@/components/panel/tercero-direcciones";
import { TerceroGeneralForm } from "@/components/panel/tercero-general-form";
import { Button } from "@/components/ui/button";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function TerceroDetallePage({
  params,
}: {
  params: Promise<{ empresaId: string; terceroId: string }>;
}) {
  const { empresaId, terceroId } = await params;
  const detalle = await obtenerTerceroConDetalle(terceroId, empresaId);
  if (!detalle) notFound();
  const { tercero, contactos, direcciones, cuentasBancarias } = detalle;

  const [cuentas, categorias, monedas, impuestos, grupos, bancos] = await Promise.all([
    listarPlanCuentasDeEmpresa(empresaId),
    listarCategorias(empresaId),
    listarMonedasDeEmpresa(empresaId),
    listarImpuestosDeEmpresa(empresaId),
    listarGruposTercero(empresaId),
    listarBancos(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TypographyHeading
          title={`${tercero.codigo ?? ""} ${tercero.razonSocial}`.trim()}
          description={`${tercero.tipoTercero} · ${tercero.rut}`}
        />
        <Button asChild variant="outline" size="sm">
          <Link href={`/panel/${empresaId}/maestros/terceros`}>← Socios de negocio</Link>
        </Button>
      </div>

      <TerceroGeneralForm
        empresaId={empresaId}
        terceroId={terceroId}
        codigo={tercero.codigo}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
        categorias={categorias.map((c) => ({ id: c.id, label: c.nombre }))}
        monedas={monedas.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }))}
        impuestos={impuestos.map((i) => ({ id: i.id, label: `${i.codigo} — ${i.nombre}` }))}
        grupos={grupos.map((g) => ({ id: g.id, label: `${g.codigo} — ${g.nombre}` }))}
        valoresIniciales={{
          rut: tercero.rut,
          razonSocial: tercero.razonSocial,
          tipoTercero: tercero.tipoTercero,
          nombreFantasia: tercero.nombreFantasia ?? "",
          giro: tercero.giro ?? "",
          email: tercero.email ?? "",
          telefono: tercero.telefono ?? "",
          sitioWeb: tercero.sitioWeb ?? "",
          direccion: tercero.direccion ?? "",
          notas: tercero.notas ?? "",
          grupoId: tercero.grupoId ?? undefined,
          monedaId: tercero.monedaId ?? undefined,
          impuestoDefaultId: tercero.impuestoDefaultId ?? undefined,
          cuentaContableAsociadaId: tercero.cuentaContableAsociadaId ?? undefined,
          categoriaContableDefaultId: tercero.categoriaContableDefaultId ?? undefined,
          condicionPagoDias: tercero.condicionPagoDias,
          limiteCredito: Number(tercero.limiteCredito),
          retencionHonorariosPct:
            tercero.retencionHonorariosPct == null ? undefined : Number(tercero.retencionHonorariosPct),
          esEmisorBoletaHonorarios: tercero.esEmisorBoletaHonorarios,
          esReceptorBoletaHonorarios: tercero.esReceptorBoletaHonorarios,
          pendienteCompletar: tercero.pendienteCompletar,
          activo: tercero.activo,
          bloqueado: tercero.bloqueado,
          motivoBloqueo: tercero.motivoBloqueo ?? "",
        }}
      />

      <TerceroContactos empresaId={empresaId} terceroId={terceroId} contactos={contactos} />
      <TerceroDirecciones empresaId={empresaId} terceroId={terceroId} direcciones={direcciones} />
      <TerceroCuentasBancarias
        empresaId={empresaId}
        terceroId={terceroId}
        cuentas={cuentasBancarias}
        bancos={bancos.map((b) => ({ id: b.id, label: b.nombre }))}
      />
    </>
  );
}
