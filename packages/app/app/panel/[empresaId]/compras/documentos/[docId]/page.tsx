import { notFound } from "next/navigation";
import {
  listarCategorias,
  listarCentrosCosto,
  listarImpuestosDeEmpresa,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  listarProductosParaCompra,
  listarTerceros,
  listarTiposDocumento,
  obtenerDocumentoCompraConLineas,
  obtenerPreferenciaFormulario,
} from "@erp/db";
import { configFormularioDocSchema } from "@erp/shared";
import { requireSession } from "@/lib/auth-helpers";
import { CLAVE_FORM_DOC_COMPRA } from "@/lib/documento-compra-campos";
import { DocumentoCompraForm } from "@/components/panel/documento-compra-form";
import { DocumentoCompraToolbar } from "@/components/panel/documento-compra-toolbar";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function DocumentoCompraDetallePage({
  params,
}: {
  params: Promise<{ empresaId: string; docId: string }>;
}) {
  const { empresaId, docId } = await params;
  const session = await requireSession();
  const detalle = await obtenerDocumentoCompraConLineas(docId, empresaId);
  if (!detalle) notFound();
  const { documento, lineas, asiento } = detalle;

  const [terceros, tiposDoc, cuentas, categorias, centros, impuestos, monedas, configRaw, productos] =
    await Promise.all([
      listarTerceros(empresaId),
      listarTiposDocumento(),
      listarPlanCuentasDeEmpresa(empresaId),
      listarCategorias(empresaId),
      listarCentrosCosto(empresaId),
      listarImpuestosDeEmpresa(empresaId),
      listarMonedasDeEmpresa(empresaId),
      obtenerPreferenciaFormulario(session.user.id, CLAVE_FORM_DOC_COMPRA),
      listarProductosParaCompra(empresaId),
    ]);

  const cfgParsed = configFormularioDocSchema.safeParse(configRaw ?? {});
  const config = cfgParsed.success ? cfgParsed.data : configFormularioDocSchema.parse({});

  const tienePendiente =
    documento.docTipo === "pedido" || documento.docTipo === "entrada_mercaderia";
  const lineasPendientes: Record<number, number> = {};
  if (tienePendiente) {
    lineas.forEach((l, i) => {
      lineasPendientes[i] = Number(l.cantidadPendiente);
    });
  }

  return (
    <>
      <TypographyHeading
        title={`${documento.numeroInterno ?? ""} ${documento.docTipo}`.trim()}
        description="Documento de compra. Solo se edita en borrador; al contabilizar se genera el asiento."
      />
      <DocumentoCompraToolbar
        empresaId={empresaId}
        docId={docId}
        docTipo={documento.docTipo}
        estado={documento.estado}
        config={config}
        lineasPendientes={lineas
          .filter((l) => Number(l.cantidadPendiente) > 0)
          .map((l) => ({
            id: l.id,
            numeroLinea: l.numeroLinea,
            glosa: l.glosa,
            cantidadPendiente: Number(l.cantidadPendiente),
            precioUnitario: Number(l.precioUnitario),
          }))}
      />
      <DocumentoCompraForm
        empresaId={empresaId}
        docId={docId}
        docTipo={documento.docTipo}
        estado={documento.estado}
        numeroInterno={documento.numeroInterno}
        asientoCorrelativo={asiento?.correlativo ?? null}
        config={config}
        lineasPendientes={tienePendiente ? lineasPendientes : undefined}
        proveedores={terceros
          .filter((t) => t.tipoTercero === "Proveedor")
          .map((t) => ({
            id: t.id,
            label: t.razonSocial,
            condicionPagoDias: t.condicionPagoDias,
          }))}
        tiposDocumento={tiposDoc
          .filter((t) => t.tipoOperacion === "Compra" || t.tipoOperacion === "Ambos")
          .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}` }))}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
        categorias={categorias.map((c) => ({
          id: c.id,
          label: c.nombre,
          ivaRecuperableDefault: c.ivaRecuperableDefault,
        }))}
        centrosCosto={centros
          .filter((c) => c.estado === "Activo")
          .map((c) => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` }))}
        impuestos={impuestos
          .filter((i) => i.activo && (i.aplicaA === "Compra" || i.aplicaA === "Ambos"))
          .map((i) => ({ id: i.id, label: `${i.codigo} — ${i.nombre}`, tasa: Number(i.tasa) }))}
        monedas={monedas.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }))}
        productos={productos.map((p) => ({
          id: p.id,
          label: `${p.codigo} — ${p.nombre}`,
          cuentaImputacionId: p.cuentaImputacionId,
          impuestoId: p.impuestoId,
          centroCostoId: p.centroCostoId,
          categoriaContableId: p.categoriaContableId,
          precioUnitario: p.precioUnitario,
          glosaSugerida: p.glosaSugerida,
        }))}
        valoresIniciales={{
          docTipo: documento.docTipo,
          terceroId: documento.terceroId,
          tipoDocumentoId: documento.tipoDocumentoId,
          folio: documento.folio ?? "",
          fechaEmision: documento.fechaEmision,
          fechaVencimiento: documento.fechaVencimiento ?? documento.fechaEmision,
          fechaContabilizacion: documento.fechaContabilizacion ?? documento.fechaEmision,
          numAtCard: documento.numAtCard ?? "",
          monedaId: documento.monedaId,
          tipoCambio: Number(documento.tipoCambio),
          descuentoGlobalPct: Number(documento.descuentoGlobalPct),
          condicionPagoDias: documento.condicionPagoDias ?? null,
          glosa: documento.glosa ?? "",
          documentoBaseId: documento.documentoBaseId ?? undefined,
          lineas:
            lineas.length > 0
              ? lineas.map((l) => ({
                  glosa: l.glosa ?? "",
                  productoId: l.productoId ?? undefined,
                  cuentaImputacionId: l.cuentaImputacionId,
                  categoriaContableId: l.categoriaContableId ?? undefined,
                  centroCostoId: l.centroCostoId ?? undefined,
                  impuestoId: l.impuestoId ?? undefined,
                  cantidad: Number(l.cantidad),
                  precioUnitario: Number(l.precioUnitario),
                  descuentoLineaPct: Number(l.descuentoLineaPct),
                  esExento: l.esExento,
                  ivaRecuperable: l.ivaRecuperable ?? undefined,
                }))
              : [
                  {
                    glosa: "",
                    productoId: undefined,
                    cuentaImputacionId: "",
                    categoriaContableId: undefined,
                    centroCostoId: undefined,
                    impuestoId: undefined,
                    cantidad: 1,
                    precioUnitario: 0,
                    descuentoLineaPct: 0,
                    esExento: false,
                    ivaRecuperable: undefined,
                  },
                ],
        }}
      />
    </>
  );
}
