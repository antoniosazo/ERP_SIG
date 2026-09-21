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
import { TerceroCuentaCorriente } from "@/components/panel/tercero-cuenta-corriente";
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

  // `cuentaContableAsociadaId` es la cuenta puente (cuenta por cobrar/pagar) del
  // tercero: debe ser una cuenta de último nivel y, para Cliente/Proveedor, del tipo
  // correspondiente — si no, se podría asociar por error una cuenta de otra clase (ej.
  // un gasto) y el asiento de venta/compra quedaría mal armado.
  const TIPO_CUENTA_POR_TERCERO: Partial<Record<string, { clase: string; tipoCuenta: string }>> = {
    Cliente: { clase: "Activo", tipoCuenta: "Cliente" },
    Proveedor: { clase: "Pasivo", tipoCuenta: "Proveedor" },
  };
  const tipoCuentaEsperado = TIPO_CUENTA_POR_TERCERO[tercero.tipoTercero];

  // La categoría contable por defecto alimenta cuentaGastoId (compra) o cuentaIngresoId
  // (venta) según de dónde venga el documento — mostrar solo las categorías compatibles
  // con el tipo de tercero evita elegir, por ejemplo, una categoría "Venta" para un
  // Proveedor que nunca tendría cuenta de gasto configurada.
  const APLICA_A_POR_TERCERO: Partial<Record<string, string[]>> = {
    Cliente: ["Venta", "Ambos"],
    Proveedor: ["Compra", "Ambos"],
    "Prestador Honorarios": ["Honorario", "Ambos"],
  };
  const aplicaAEsperado = APLICA_A_POR_TERCERO[tercero.tipoTercero];

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

      <TerceroCuentaCorriente empresaId={empresaId} terceroId={terceroId} tipoTercero={tercero.tipoTercero} />

      <TerceroGeneralForm
        empresaId={empresaId}
        terceroId={terceroId}
        codigo={tercero.codigo}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .filter(
            (c) =>
              !tipoCuentaEsperado ||
              (c.clase === tipoCuentaEsperado.clase && c.tipoCuenta === tipoCuentaEsperado.tipoCuenta),
          )
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
        categorias={categorias
          .filter((c) => !aplicaAEsperado || aplicaAEsperado.includes(c.aplicaA))
          .map((c) => ({ id: c.id, label: c.nombre }))}
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
