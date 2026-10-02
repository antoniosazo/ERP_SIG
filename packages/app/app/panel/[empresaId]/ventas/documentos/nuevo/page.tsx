import { notFound, redirect } from "next/navigation";
import {
  listarCategorias,
  listarCentrosCosto,
  listarDocumentosVenta,
  listarImpuestosDeEmpresa,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  listarProductosParaDocumento,
  listarTerceros,
  listarTiposDocumento,
  listarUsuariosDeEmpresa,
  obtenerEmpresa,
  obtenerPreferenciaFormulario,
} from "@erp/db";
import { DOCUMENTO_VENTA_CLASE, configFormularioDocSchema, puedeEditarFinanzas, uuid } from "@erp/shared";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { CODIGO_SII_HABITUAL_VENTA, opcionesFormularioVenta } from "@/lib/ventas-catalogos";
import { VENTA_CLASE_META } from "@/lib/ventas";
import { CLAVE_FORM_DOC_VENTA } from "@/lib/documento-venta-campos";
import { DocumentoVentaForm } from "@/components/panel/documento-venta-form";
import { VolverBoton } from "@/components/panel/volver-boton";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

/** Documento de venta en blanco: no se guarda nada hasta que el usuario pulsa Guardar. */
export default async function NuevoDocumentoVentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<{ clase?: string; terceroId?: string }>;
}) {
  const [{ empresaId }, { clase: claseParam, terceroId }] = await Promise.all([params, searchParams]);
  const clase = DOCUMENTO_VENTA_CLASE.find((c) => c === claseParam);
  if (!clase) notFound();
  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();
  const meta = VENTA_CLASE_META[clase];
  if (!puedeEditarFinanzas(acceso.session.user.esAdminFirma, acceso.rol)) redirect(`/panel/${empresaId}/ventas/${meta.slug}`);

  const [terceros, tiposDoc, cuentas, categorias, centros, impuestos, monedas, facturas, configRaw, vendedores, productos, empresa] =
    await Promise.all([
      listarTerceros(empresaId),
      listarTiposDocumento(),
      listarPlanCuentasDeEmpresa(empresaId),
      listarCategorias(empresaId),
      listarCentrosCosto(empresaId),
      listarImpuestosDeEmpresa(empresaId),
      listarMonedasDeEmpresa(empresaId),
      listarDocumentosVenta(empresaId, { estado: "contabilizado" }),
      obtenerPreferenciaFormulario(acceso.session.user.id, CLAVE_FORM_DOC_VENTA),
      listarUsuariosDeEmpresa(empresaId),
      listarProductosParaDocumento(empresaId),
      obtenerEmpresa(empresaId),
    ]);

  const opciones = opcionesFormularioVenta({ terceros, tiposDoc, cuentas, categorias, centros, impuestos, monedas, productos, vendedores, facturas }, clase);
  const cfg = configFormularioDocSchema.safeParse(configRaw ?? {});
  const config = cfg.success ? cfg.data : configFormularioDocSchema.parse({});
  const hoy = new Date().toISOString().slice(0, 10);
  const cliente = terceroId && uuid.safeParse(terceroId).success ? opciones.clientes.find((c) => c.id === terceroId) : undefined;
  const tipoDocumentoId = opciones.tiposDocumento.find((t) => t.codigoSii === CODIGO_SII_HABITUAL_VENTA[clase])?.id;
  const monedaId = monedas.find((m) => m.id === empresa?.monedaFuncionalId)?.id ?? monedas[0]?.id ?? "";
  const dias = cliente?.condicionPagoDias ?? 0;
  const vencimiento = new Date(`${hoy}T00:00:00Z`);
  vencimiento.setUTCDate(vencimiento.getUTCDate() + dias);

  return (
    <>
      <VolverBoton fallbackHref={`/panel/${empresaId}/ventas/${meta.slug}`} />
      <TypographyHeading title={`Nueva ${meta.singular}`} description="No se guarda nada hasta que pulses Guardar." />
      <DocumentoVentaForm
        empresaId={empresaId}
        docId={null}
        estado="borrador"
        numeroInterno={null}
        clase={clase}
        asientoCorrelativo={null}
        puedeEditar
        puedeAnular={false}
        hoy={hoy}
        config={config}
        contactos={[]}
        {...opciones}
        saldosReferencia={{}}
        valoresIniciales={{
          modalidad: "Artículo",
          terceroId: cliente?.id ?? "",
          tipoDocumentoId: tipoDocumentoId ?? "",
          folio: "",
          fechaEmision: hoy,
          fechaVencimiento: vencimiento.toISOString().slice(0, 10),
          fechaContabilizacion: hoy,
          numAtCard: "",
          monedaId,
          tipoCambio: 1,
          descuentoGlobalPct: 0,
          glosa: "",
          documentoReferenciaId: undefined,
          nombreCliente: cliente?.label ?? "",
          condicionPagoDias: cliente ? dias : null,
          vendedorId: undefined,
          contactoId: undefined,
          direccionFacturacion: "",
          direccionDespacho: "",
          lineas: [
            {
              glosa: "",
              productoId: undefined,
              cuentaIngresoId: "",
              categoriaContableId: undefined,
              centroCostoId: undefined,
              impuestoId: undefined,
              cantidad: 1,
              precioUnitario: 0,
              descuentoLineaPct: 0,
              esExento: false,
              fechaDiferimiento: undefined,
            },
          ],
        }}
      />
    </>
  );
}
