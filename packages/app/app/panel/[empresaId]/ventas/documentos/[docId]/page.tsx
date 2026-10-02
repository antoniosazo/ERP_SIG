import { EnlaceDetalle } from "@/components/panel/enlace-detalle";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  notasCreditoDeFactura,
  obtenerDocumentoVentaConLineas,
  db,
  obtenerEmpresa,
  obtenerPreferenciaFormulario,
  productosPorIds,
  saldosDocumentos,
  obtenerTerceroConDetalle,
  pagosDeDocumentoVenta,
  saldosNotaCreditoPorFactura,
} from "@erp/db";
import {
  configFormularioDocSchema,
  puedeEditarFinanzas,
} from "@erp/shared";
import { obtenerAccesoEmpresa } from "@/lib/auth-helpers";
import { facturaDeDocumento } from "@/lib/factura-documento";
import { opcionesFormularioVenta } from "@/lib/ventas-catalogos";
import { cadenaDeDocumentos } from "@/lib/mapa-cadena";
import { CadenaDocumentos } from "@/components/panel/cadena-documentos";
import { CLAVE_FORM_DOC_VENTA } from "@/lib/documento-venta-campos";
import { DocumentoVentaForm } from "@/components/panel/documento-venta-form";
import { DocumentoVentaToolbar } from "@/components/panel/documento-venta-toolbar";
import { EmitirNotaCreditoBoton } from "@/components/panel/emitir-nota-credito-boton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VolverBoton } from "@/components/panel/volver-boton";
import { VENTA_CLASE_META } from "@/lib/ventas";
import { TypographyHeading } from "@/components/ui/typography";

export const dynamic = "force-dynamic";

export default async function DocumentoVentaDetallePage({
  params,
}: {
  params: Promise<{ empresaId: string; docId: string }>;
}) {
  const { empresaId, docId } = await params;
  const acceso = await obtenerAccesoEmpresa(empresaId);
  if (!acceso) notFound();
  const detalle = await obtenerDocumentoVentaConLineas(docId, empresaId);
  if (!detalle) notFound();
  const { documento, lineas, asiento, reversa } = detalle;
  const puedeEditar = puedeEditarFinanzas(acceso.session.user.esAdminFirma, acceso.rol);
  const puedeAnular = acceso.session.user.esAdminFirma || acceso.rol === "Administrador";

  const esFactura = documento.clase === "Factura";
  const [
    terceros,
    tiposDoc,
    cuentas,
    categorias,
    centros,
    impuestos,
    monedas,
    facturas,
    saldos,
    notasCredito,
    configRaw,
    terceroDetalle,
    vendedores,
    productos,
    pagosAplicados,
    cadena,
  ] = await Promise.all([
    listarTerceros(empresaId),
    listarTiposDocumento(),
    listarPlanCuentasDeEmpresa(empresaId),
    listarCategorias(empresaId),
    listarCentrosCosto(empresaId),
    listarImpuestosDeEmpresa(empresaId),
    listarMonedasDeEmpresa(empresaId),
    listarDocumentosVenta(empresaId, { estado: "contabilizado" }),
    saldosNotaCreditoPorFactura(empresaId),
    esFactura ? notasCreditoDeFactura(empresaId, docId) : Promise.resolve([]),
    obtenerPreferenciaFormulario(acceso.session.user.id, CLAVE_FORM_DOC_VENTA),
    obtenerTerceroConDetalle(documento.terceroId, empresaId),
    listarUsuariosDeEmpresa(empresaId),
    listarProductosParaDocumento(empresaId),
    pagosDeDocumentoVenta(empresaId, docId),
    puedeEditar ? cadenaDeDocumentos(empresaId, "documentos_venta", docId) : Promise.resolve(null),
  ]);

  const [empresa, productosDoc] = await Promise.all([
    obtenerEmpresa(empresaId),
    productosPorIds(
      empresaId,
      lineas.map((l) => l.productoId).filter((x): x is string => !!x),
    ),
  ]);
  const clienteDoc = terceros.find((t) => t.id === documento.terceroId);
  const tipoDocVenta = tiposDoc.find((t) => t.id === documento.tipoDocumentoId);
  const saldoDoc =
    documento.estado === "contabilizado" && (documento.clase === "Factura" || documento.clase === "Nota de Débito")
      ? (await saldosDocumentos(db, empresaId, "venta", [docId])).get(docId)
      : undefined;
  const factura = facturaDeDocumento({
    origen: "venta",
    documento,
    lineas,
    empresa: { razonSocial: empresa?.razonSocial ?? "", rut: empresa?.rut ?? "" },
    tercero: clienteDoc && { razonSocial: clienteDoc.razonSocial, rut: clienteDoc.rut },
    tipoDocumento: tipoDocVenta?.nombre ?? documento.clase,
    productos: productosDoc,
    saldo: saldoDoc,
  });

  const cfgParsed = configFormularioDocSchema.safeParse(configRaw ?? {});
  const config = cfgParsed.success ? cfgParsed.data : configFormularioDocSchema.parse({});
  const contactos = (terceroDetalle?.contactos ?? []).map((c) => ({ id: c.id, label: c.nombre }));

  const tiposNC = tiposDoc
    .filter((t) => t.codigoSii === "61")
    .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}` }));
  const saldoFactura = esFactura ? (saldos[docId] ?? Number(documento.montoTotal)) : 0;
  const opciones = opcionesFormularioVenta(
    { terceros, tiposDoc, cuentas, categorias, centros, impuestos, monedas, productos, vendedores, facturas },
    documento.clase,
    { clienteActualId: documento.terceroId, excluirDocumentoId: docId },
  );
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <VolverBoton fallbackHref={`/panel/${empresaId}/ventas/${VENTA_CLASE_META[documento.clase].slug}`} />
      {(documento.asientoId || documento.asientoReversaId) && (
        <div className="my-3 flex flex-wrap gap-3">
          {documento.asientoId && (
            <EnlaceDetalle href={`/panel/${empresaId}/contabilidad/asientos/${documento.asientoId}`}>
              Ver asiento contable completo
            </EnlaceDetalle>
          )}
          {documento.asientoReversaId && (
            <EnlaceDetalle href={`/panel/${empresaId}/contabilidad/asientos/${documento.asientoReversaId}`}>
              Ver asiento de reversa{reversa?.correlativo ? ` N° ${reversa.correlativo}` : ""}
            </EnlaceDetalle>
          )}
        </div>
      )}
      {cadena && <div className="my-3"><CadenaDocumentos etapas={cadena} /></div>}
      <TypographyHeading
        title={`${documento.numeroInterno ?? ""} ${documento.clase}`.trim()}
        description={
          documento.clase === "Factura"
            ? "Factura contabilizada automáticamente. Una vez contabilizada solo se editan la fecha de vencimiento y la de contabilización."
            : "Documento de venta. Solo se puede editar en borrador; al contabilizar se genera el asiento."
        }
      />
      <DocumentoVentaToolbar
        empresaId={empresaId}
        docId={docId}
        config={config}
        factura={factura}
        puedeVerContabilidad={puedeEditar}
      />
      <DocumentoVentaForm
        empresaId={empresaId}
        docId={docId}
        estado={documento.estado}
        numeroInterno={documento.numeroInterno}
        clase={documento.clase}
        asientoCorrelativo={asiento?.correlativo ?? null}
        puedeEditar={puedeEditar}
        puedeAnular={puedeAnular}
        hoy={hoy}
        config={config}
        contactos={contactos}
        {...opciones}
        saldosReferencia={saldos}
        valoresIniciales={{
          modalidad: documento.modalidad,
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
          glosa: documento.glosa ?? "",
          documentoReferenciaId: documento.documentoReferenciaId ?? undefined,
          nombreCliente: documento.nombreCliente ?? "",
          condicionPagoDias: documento.condicionPagoDias ?? null,
          vendedorId: documento.vendedorId ?? undefined,
          contactoId: documento.contactoId ?? undefined,
          direccionFacturacion: documento.direccionFacturacion ?? "",
          direccionDespacho: documento.direccionDespacho ?? "",
          lineas:
            lineas.length > 0
              ? lineas.map((l) => ({
                  glosa: l.glosa ?? "",
                  productoId: l.productoId ?? undefined,
                  cuentaIngresoId: l.cuentaIngresoId,
                  categoriaContableId: l.categoriaContableId ?? undefined,
                  centroCostoId: l.centroCostoId ?? undefined,
                  impuestoId: l.impuestoId ?? undefined,
                  cantidad: Number(l.cantidad),
                  precioUnitario: Number(l.precioUnitario),
                  descuentoLineaPct: Number(l.descuentoLineaPct),
                  esExento: l.esExento,
                  fechaDiferimiento: l.fechaDiferimiento ?? undefined,
                }))
              : [
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

      {(documento.clase === "Factura" || documento.clase === "Nota de Débito") && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Cobros aplicados</CardTitle>
              <p className="text-sm text-muted-foreground">
                Saldo pendiente: {(saldoDoc?.saldo ?? Number(documento.montoTotal)).toLocaleString("es-CL")}
              </p>
            </div>
            {puedeEditar && documento.estado === "contabilizado" && (saldoDoc?.saldo ?? 0) > 0.005 && (
              <Button asChild>
                <Link href={`/panel/${empresaId}/tesoreria/pagos-recibidos/nuevo?terceroId=${documento.terceroId}&documentoId=${docId}`}>
                  Registrar cobro
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pagosAplicados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay cobros aplicados a este documento.</p>
            ) : (
              <div className="rounded-xl ring-1 ring-foreground/10">
                <Table>
                  <TableHeader><TableRow><TableHead>Cobro</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Aplicado</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pagosAplicados.map((pago) => (
                      <TableRow key={pago.id}>
                        <TableCell><Link className="font-mono hover:underline" href={`/panel/${empresaId}/tesoreria/pagos-recibidos/${pago.id}`}>{pago.numeroInterno}</Link></TableCell>
                        <TableCell>{pago.fechaPago}</TableCell>
                        <TableCell><Badge variant={pago.estado === "anulado" ? "destructive" : "secondary"}>{pago.estado}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{Number(pago.montoAplicado).toLocaleString("es-CL")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {esFactura && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Notas de crédito</CardTitle>
              <p className="text-sm text-muted-foreground">
                Saldo disponible: {saldoFactura.toLocaleString("es-CL")} de{" "}
                {Number(documento.montoTotal).toLocaleString("es-CL")}
              </p>
            </div>
            {documento.estado === "contabilizado" && puedeEditar && (
              <EmitirNotaCreditoBoton
                empresaId={empresaId}
                facturaId={docId}
                saldo={saldoFactura}
                tiposNC={tiposNC}
              />
            )}
          </CardHeader>
          <CardContent>
            {notasCredito.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta factura no tiene notas de crédito.
              </p>
            ) : (
              <div className="rounded-xl ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">N° interno</TableHead>
                      <TableHead>Folio</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notasCredito.map((nc) => (
                      <TableRow key={nc.id}>
                        <TableCell className="font-mono font-medium">
                          <Link
                            href={`/panel/${empresaId}/ventas/documentos/${nc.id}`}
                            className="hover:underline"
                          >
                            {nc.numeroInterno ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {nc.folio ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {nc.fechaEmision}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(nc.montoTotal).toLocaleString("es-CL")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              nc.estado === "contabilizado"
                                ? "secondary"
                                : nc.estado === "anulado"
                                  ? "destructive"
                                  : "default"
                            }
                          >
                            {nc.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
