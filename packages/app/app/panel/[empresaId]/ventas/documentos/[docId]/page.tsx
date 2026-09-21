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
  saldosNotaCreditoPorFactura,
} from "@erp/db";
import { configFormularioDocSchema } from "@erp/shared";
import { requireSession } from "@/lib/auth-helpers";
import { facturaDeDocumento } from "@/lib/factura-documento";
import { CLAVE_FORM_DOC_VENTA } from "@/lib/documento-venta-campos";
import { DocumentoVentaForm } from "@/components/panel/documento-venta-form";
import { DocumentoVentaToolbar } from "@/components/panel/documento-venta-toolbar";
import { EmitirNotaCreditoBoton } from "@/components/panel/emitir-nota-credito-boton";
import { Badge } from "@/components/ui/badge";
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
  const session = await requireSession();
  const detalle = await obtenerDocumentoVentaConLineas(docId, empresaId);
  if (!detalle) notFound();
  const { documento, lineas, asiento } = detalle;

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
    obtenerPreferenciaFormulario(session.user.id, CLAVE_FORM_DOC_VENTA),
    obtenerTerceroConDetalle(documento.terceroId, empresaId),
    listarUsuariosDeEmpresa(empresaId),
    listarProductosParaDocumento(empresaId),
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
  const tiposNCFallback = tiposNC.length
    ? tiposNC
    : tiposDoc
        .filter((t) => t.tipoOperacion === "Venta" || t.tipoOperacion === "Ambos")
        .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}` }));
  const saldoFactura = esFactura ? (saldos[docId] ?? Number(documento.montoTotal)) : 0;

  return (
    <>
      <VolverBoton fallbackHref={`/panel/${empresaId}/ventas/${VENTA_CLASE_META[documento.clase].slug}`} />
      <TypographyHeading
        title={`${documento.numeroInterno ?? ""} ${documento.clase}`.trim()}
        description={
          documento.clase === "Factura"
            ? "Factura contabilizada automáticamente. Una vez contabilizada solo se editan la fecha de vencimiento y la de contabilización."
            : "Documento de venta. Solo se puede editar en borrador; al contabilizar se genera el asiento."
        }
      />
      <DocumentoVentaToolbar empresaId={empresaId} docId={docId} config={config} factura={factura} />
      <DocumentoVentaForm
        empresaId={empresaId}
        docId={docId}
        estado={documento.estado}
        numeroInterno={documento.numeroInterno}
        clase={documento.clase}
        asientoCorrelativo={asiento?.correlativo ?? null}
        config={config}
        contactos={contactos}
        vendedores={vendedores.map((u) => ({ id: u.id, label: u.nombre }))}
        productos={productos.map((p) => ({
          id: p.id,
          label: `${p.codigo} — ${p.nombre}`,
          cuentaIngresoId: p.cuentaIngresoId,
          impuestoId: p.impuestoId,
          centroCostoId: p.centroCostoId,
          categoriaContableId: p.categoriaContableId,
          precioUnitario: p.precioUnitario,
          glosaSugerida: p.glosaSugerida,
        }))}
        clientes={terceros
          .filter((t) => t.tipoTercero === "Cliente")
          .map((t) => ({
            id: t.id,
            label: t.razonSocial,
            condicionPagoDias: t.condicionPagoDias,
          }))}
        tiposDocumento={tiposDoc
          .filter((t) => t.tipoOperacion === "Venta" || t.tipoOperacion === "Ambos")
          .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}` }))}
        cuentas={cuentas
          .filter((c) => c.nivelImputable && c.activa)
          .map((c) => ({ id: c.id, label: `${c.codigoCuenta} — ${c.nombreCuenta}` }))}
        categorias={categorias.map((c) => ({ id: c.id, label: c.nombre }))}
        centrosCosto={centros
          .filter((c) => c.estado === "Activo")
          .map((c) => ({ id: c.id, label: `${c.codigo} — ${c.nombre}` }))}
        impuestos={impuestos
          .filter((i) => i.activo && (i.aplicaA === "Venta" || i.aplicaA === "Ambos"))
          .map((i) => ({ id: i.id, label: `${i.codigo} — ${i.nombre}`, tasa: Number(i.tasa) }))}
        monedas={monedas.map((m) => ({ id: m.id, label: `${m.codigo} — ${m.nombre}` }))}
        docsReferencia={facturas
          .filter((f) => f.clase === "Factura" && f.id !== docId)
          .map((f) => ({ id: f.id, label: `${f.numeroInterno ?? ""} folio ${f.folio ?? "—"}` }))}
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
            {documento.estado === "contabilizado" && (
              <EmitirNotaCreditoBoton
                empresaId={empresaId}
                facturaId={docId}
                saldo={saldoFactura}
                tiposNC={tiposNCFallback}
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
