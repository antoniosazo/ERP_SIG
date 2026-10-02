import { notFound, redirect } from "next/navigation";
import {
  listarCategorias,
  listarCentrosCosto,
  listarDocumentosCompra,
  listarImpuestosDeEmpresa,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  listarProductosParaCompra,
  listarTerceros,
  listarTiposDocumento,
  obtenerEmpresa,
  obtenerPreferenciaFormulario,
} from "@erp/db";
import { DOCUMENTO_COMPRA_TIPO, configFormularioDocSchema, puedeEditarFinanzas, uuid, type DocumentoCompraTipo } from "@erp/shared";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { CODIGO_SII_HABITUAL, opcionesFormularioCompra } from "@/lib/compras-catalogos";
import { COMPRA_TIPO_META } from "@/lib/compras";
import { CLAVE_FORM_DOC_COMPRA } from "@/lib/documento-compra-campos";
import { DocumentoCompraForm } from "@/components/panel/documento-compra-form";
import { VolverBoton } from "@/components/panel/volver-boton";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

/** Documento de compra en blanco: no se guarda nada hasta que el usuario pulsa Guardar. */
export default async function NuevoDocumentoCompraPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ docTipo?: string; terceroId?: string }>;
}) {
  const [{ empresaId }, { docTipo: docTipoParam, terceroId }] = await Promise.all([params, searchParams]);
  const docTipo = DOCUMENTO_COMPRA_TIPO.find((t) => t === docTipoParam) as DocumentoCompraTipo | undefined;
  if (!docTipo) notFound();
  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();
  const meta = COMPRA_TIPO_META[docTipo];
  if (!puedeEditarFinanzas(acceso.session.user.esAdminFirma, acceso.rol)) redirect(`/panel/${empresaId}/compras/${meta.slug}`);

  const [terceros, tiposDoc, cuentas, categorias, centros, impuestos, monedas, configRaw, productos, facturasReferencia, empresa] =
    await Promise.all([
      listarTerceros(empresaId),
      listarTiposDocumento(),
      listarPlanCuentasDeEmpresa(empresaId),
      listarCategorias(empresaId),
      listarCentrosCosto(empresaId),
      listarImpuestosDeEmpresa(empresaId),
      listarMonedasDeEmpresa(empresaId),
      obtenerPreferenciaFormulario(acceso.session.user.id, CLAVE_FORM_DOC_COMPRA),
      listarProductosParaCompra(empresaId),
      listarDocumentosCompra(empresaId, { docTipo: "factura", estado: "contabilizado" }),
      obtenerEmpresa(empresaId),
    ]);

  const opciones = opcionesFormularioCompra({ terceros, tiposDoc, cuentas, categorias, centros, impuestos, monedas, productos, facturasReferencia }, docTipo);
  const cfg = configFormularioDocSchema.safeParse(configRaw ?? {});
  const config = cfg.success ? cfg.data : configFormularioDocSchema.parse({});
  const hoy = new Date().toISOString().slice(0, 10);
  const proveedor = terceroId && uuid.safeParse(terceroId).success ? opciones.proveedores.find((p) => p.id === terceroId) : undefined;
  const habitual = CODIGO_SII_HABITUAL[docTipo];
  const tipoDocumentoId = docTipo === "pedido" ? undefined : opciones.tiposDocumento.find((t) => t.codigoSii === habitual)?.id;
  const monedaId = monedas.find((m) => m.id === empresa?.monedaFuncionalId)?.id ?? monedas[0]?.id ?? "";
  const dias = proveedor?.condicionPagoDias ?? 0;
  const vencimiento = new Date(`${hoy}T00:00:00Z`);
  vencimiento.setUTCDate(vencimiento.getUTCDate() + dias);

  return (
    <>
      <VolverBoton fallbackHref={`/panel/${empresaId}/compras/${meta.slug}`} />
      <TypographyHeading title={`Nuevo ${meta.singular}`} description="No se guarda nada hasta que pulses Guardar." />
      <DocumentoCompraForm
        empresaId={empresaId}
        docId={null}
        docTipo={docTipo}
        estado="borrador"
        numeroInterno={null}
        asientoCorrelativo={null}
        puedeEditar
        puedeAnular={false}
        hoy={hoy}
        config={config}
        {...opciones}
        valoresIniciales={{
          modalidad: "Artículo",
          docTipo,
          terceroId: proveedor?.id ?? "",
          tipoDocumentoId,
          folio: "",
          fechaEmision: hoy,
          fechaVencimiento: vencimiento.toISOString().slice(0, 10),
          fechaContabilizacion: hoy,
          numAtCard: "",
          monedaId,
          tipoCambio: 1,
          descuentoGlobalPct: 0,
          condicionPagoDias: proveedor ? dias : null,
          glosa: "",
          documentoBaseId: undefined,
          lineas: [
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
