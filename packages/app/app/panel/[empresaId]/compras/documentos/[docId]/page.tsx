import { EnlaceDetalle } from "@/components/panel/enlace-detalle";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listarCategorias,
  listarCentrosCosto,
  listarImpuestosDeEmpresa,
  listarMonedasDeEmpresa,
  listarPlanCuentasDeEmpresa,
  listarProductosParaCompra,
  listarDocumentosCompra,
  listarTerceros,
  listarTiposDocumento,
  obtenerDocumentoCompraConLineas,
  db,
  obtenerEmpresa,
  obtenerPreferenciaFormulario,
  productosPorIds,
  saldosDocumentos,
  pagosDeDocumentoCompra,
  notasDeFacturaCompra,
} from "@erp/db";
import {
  CODIGOS_SII_COMPRA_POR_TIPO,
  configFormularioDocSchema,
  puedeEditarFinanzas,
} from "@erp/shared";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { facturaDeDocumento } from "@/lib/factura-documento";
import { CLAVE_FORM_DOC_COMPRA } from "@/lib/documento-compra-campos";
import { DocumentoCompraForm } from "@/components/panel/documento-compra-form";
import { DocumentoCompraToolbar } from "@/components/panel/documento-compra-toolbar";
import { VolverBoton } from "@/components/panel/volver-boton";
import { COMPRA_TIPO_META } from "@/lib/compras";
import { TypographyHeading } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DocumentoCompraDetallePage({
  params,
}: {
  params: Promise<{ empresaId: string; docId: string }>;
}) {
  const { empresaId, docId } = await params;
  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();
  const detalle = await obtenerDocumentoCompraConLineas(docId, empresaId);
  if (!detalle) notFound();
  const { documento, lineas, asiento, reversa } = detalle;
  const puedeEditar = puedeEditarFinanzas(acceso.session.user.esAdminFirma, acceso.rol);
  const puedeAnular = acceso.session.user.esAdminFirma || acceso.rol === "Administrador";

  const [
    terceros,
    tiposDoc,
    cuentas,
    categorias,
    centros,
    impuestos,
    monedas,
    configRaw,
    productos,
    facturasReferencia,
    pagosAplicados,
    notasRelacionadas,
  ] = await Promise.all([
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
      pagosDeDocumentoCompra(empresaId, docId),
      documento.docTipo === "factura" ? notasDeFacturaCompra(empresaId, docId) : Promise.resolve([]),
    ]);

  const [empresa, productosDoc] = await Promise.all([
    obtenerEmpresa(empresaId),
    productosPorIds(
      empresaId,
      lineas.map((l) => l.productoId).filter((x): x is string => !!x),
    ),
  ]);
  const proveedor = terceros.find((t) => t.id === documento.terceroId);
  const tipoDoc = tiposDoc.find((t) => t.id === documento.tipoDocumentoId);
  const saldoDoc =
    documento.estado === "contabilizado" && (documento.docTipo === "factura" || documento.docTipo === "nota_debito")
      ? (await saldosDocumentos(db, empresaId, "compra", [docId])).get(docId)
      : undefined;
  const factura = facturaDeDocumento({
    origen: "compra",
    documento,
    lineas,
    empresa: { razonSocial: empresa?.razonSocial ?? "", rut: empresa?.rut ?? "" },
    tercero: proveedor && { razonSocial: proveedor.razonSocial, rut: proveedor.rut },
    tipoDocumento: tipoDoc?.nombre ?? documento.docTipo,
    productos: productosDoc,
    saldo: saldoDoc,
  });

  const cfgParsed = configFormularioDocSchema.safeParse(configRaw ?? {});
  const config = cfgParsed.success ? cfgParsed.data : configFormularioDocSchema.parse({});
  const codigosPermitidos = CODIGOS_SII_COMPRA_POR_TIPO[documento.docTipo]
    ? new Set(CODIGOS_SII_COMPRA_POR_TIPO[documento.docTipo])
    : null;
  const hoy = new Date().toISOString().slice(0, 10);

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
      <VolverBoton fallbackHref={`/panel/${empresaId}/compras/${COMPRA_TIPO_META[documento.docTipo].slug}`} />
      {(documento.asientoId || documento.asientoReversaId || documento.documentoBaseId) && (
        <div className="my-3 flex flex-wrap gap-3">
          {documento.asientoId && <EnlaceDetalle href={`/panel/${empresaId}/contabilidad/asientos/${documento.asientoId}`}>Ver asiento contable completo</EnlaceDetalle>}
          {documento.asientoReversaId && <EnlaceDetalle href={`/panel/${empresaId}/contabilidad/asientos/${documento.asientoReversaId}`}>Ver asiento de reversa{reversa?.correlativo ? ` N° ${reversa.correlativo}` : ""}</EnlaceDetalle>}
          {documento.documentoBaseId && <EnlaceDetalle href={`/panel/${empresaId}/compras/documentos/${documento.documentoBaseId}`}>Ver documento de origen</EnlaceDetalle>}
        </div>
      )}
      <TypographyHeading
        title={`${documento.numeroInterno ?? ""} ${documento.docTipo}`.trim()}
        description={
          documento.docTipo === "factura"
            ? "Factura contabilizada automáticamente. Una vez contabilizada solo se editan la fecha de vencimiento y la de contabilización."
            : "Documento de compra. Solo se edita en borrador; al contabilizar se genera el asiento."
        }
      />
      <DocumentoCompraToolbar
        empresaId={empresaId}
        factura={factura}
        docId={docId}
        docTipo={documento.docTipo}
        estado={documento.estado}
        config={config}
        puedeVerContabilidad={puedeEditar}
        lineasPendientes={lineas
          .filter((l) => Number(l.cantidadPendiente) > 0)
          .map((l) => ({
            id: l.id,
            numeroLinea: l.numeroLinea,
            glosa: l.glosa,
            cantidadPendiente: Number(l.cantidadPendiente),
            precioUnitario: Number(l.precioUnitario),
            esInventario: productos.find((p) => p.id === l.productoId)?.esInventario ?? false,
          }))}
      />
      <DocumentoCompraForm
        empresaId={empresaId}
        docId={docId}
        docTipo={documento.docTipo}
        estado={documento.estado}
        numeroInterno={documento.numeroInterno}
        asientoCorrelativo={asiento?.correlativo ?? null}
        puedeEditar={puedeEditar}
        puedeAnular={puedeAnular}
        hoy={hoy}
        config={config}
        lineasPendientes={tienePendiente ? lineasPendientes : undefined}
        lineasFijas={
          !!documento.documentoBaseId &&
          documento.docTipo !== "nota_credito" &&
          documento.docTipo !== "nota_debito"
        }
        proveedores={terceros
          .filter((t) =>
            t.tipoTercero === "Proveedor" &&
            ((t.activo && !t.bloqueado) || t.id === documento.terceroId),
          )
          .map((t) => ({
            id: t.id,
            label: t.razonSocial,
            condicionPagoDias: t.condicionPagoDias,
          }))}
        tiposDocumento={tiposDoc
          .filter((t) =>
            codigosPermitidos
              ? codigosPermitidos.has(t.codigoSii)
              : t.tipoOperacion === "Compra" || t.tipoOperacion === "Ambos",
          )
          .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}` }))}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
        categorias={categorias
          .filter((c) => c.aplicaA === "Compra" || c.aplicaA === "Ambos")
          .map((c) => ({
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
        docsReferencia={facturasReferencia
          .filter((f) => f.terceroId === documento.terceroId && f.monedaId === documento.monedaId && f.id !== docId)
          .map((f) => ({ id: f.id, label: `${f.numeroInterno ?? ""} · folio ${f.folio ?? "—"}` }))}
        valoresIniciales={{
          modalidad: documento.modalidad,
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

      {(documento.docTipo === "factura" || documento.docTipo === "nota_debito") && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div><CardTitle>Pagos aplicados</CardTitle><p className="text-sm text-muted-foreground">Saldo pendiente: {(saldoDoc?.saldo ?? Number(documento.montoTotal)).toLocaleString("es-CL")}</p></div>
            {puedeEditar && documento.estado === "contabilizado" && (saldoDoc?.saldo ?? 0) > 0.005 && (
              <Button asChild><Link href={`/panel/${empresaId}/tesoreria/pagos-efectuados/nuevo?terceroId=${documento.terceroId}&documentoId=${docId}`}>Registrar pago</Link></Button>
            )}
          </CardHeader>
          <CardContent>
            {pagosAplicados.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay pagos aplicados a este documento.</p> : (
              <div className="rounded-xl ring-1 ring-foreground/10"><Table><TableHeader><TableRow><TableHead>Pago</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Aplicado</TableHead></TableRow></TableHeader><TableBody>
                {pagosAplicados.map((pago) => <TableRow key={pago.id}><TableCell><Link className="font-mono hover:underline" href={`/panel/${empresaId}/tesoreria/pagos-efectuados/${pago.id}`}>{pago.numeroInterno}</Link></TableCell><TableCell>{pago.fechaPago}</TableCell><TableCell><Badge variant={pago.estado === "anulado" ? "destructive" : "secondary"}>{pago.estado}</Badge></TableCell><TableCell className="text-right tabular-nums">{Number(pago.montoAplicado).toLocaleString("es-CL")}</TableCell></TableRow>)}
              </TableBody></Table></div>
            )}
          </CardContent>
        </Card>
      )}

      {documento.docTipo === "factura" && (
        <Card><CardHeader><CardTitle>Notas relacionadas</CardTitle></CardHeader><CardContent>
          {notasRelacionadas.length === 0 ? <p className="text-sm text-muted-foreground">Esta factura no tiene notas de crédito o débito vinculadas.</p> : (
            <div className="rounded-xl ring-1 ring-foreground/10"><Table><TableHeader><TableRow><TableHead>Documento</TableHead><TableHead>Folio</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>
              {notasRelacionadas.map((nota) => <TableRow key={nota.id}><TableCell><Link className="font-mono hover:underline" href={`/panel/${empresaId}/compras/documentos/${nota.id}`}>{nota.numeroInterno ?? nota.docTipo}</Link></TableCell><TableCell>{nota.folio ?? "—"}</TableCell><TableCell>{nota.fechaEmision}</TableCell><TableCell><Badge variant={nota.estado === "anulado" ? "destructive" : "secondary"}>{nota.estado}</Badge></TableCell><TableCell className="text-right tabular-nums">{Number(nota.montoTotal).toLocaleString("es-CL")}</TableCell></TableRow>)}
            </TableBody></Table></div>
          )}
        </CardContent></Card>
      )}
    </>
  );
}
