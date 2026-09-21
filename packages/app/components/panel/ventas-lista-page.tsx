import type { DocumentoVentaClase } from "@erp/shared";
import { listarDocumentosVenta, listarTerceros, listarTiposDocumento } from "@erp/db";
import { DocumentosVentaLista } from "@/components/panel/documentos-venta-lista";
import { VENTA_CLASE_META } from "@/lib/ventas";
import { TypographyHeading } from "@/components/ui/typography";

/** Lista de documentos de venta de una clase (Factura / Nota de Crédito / Nota de Débito). */
export async function VentasListaPage({
  empresaId,
  clase,
  estado,
}: {
  empresaId: string;
  clase: DocumentoVentaClase;
  estado?: string;
}) {
  const meta = VENTA_CLASE_META[clase];
  const [documentos, terceros, tiposDoc] = await Promise.all([
    listarDocumentosVenta(empresaId, { clase, estado: estado || undefined }),
    listarTerceros(empresaId),
    listarTiposDocumento(),
  ]);

  const tipoNombre = new Map(tiposDoc.map((t) => [t.id, t.nombre]));
  const clienteNombre = new Map(terceros.map((t) => [t.id, t.razonSocial]));

  return (
    <>
      <TypographyHeading
        title={meta.titulo}
        description={
          clase === "Factura"
            ? "Las facturas se contabilizan solas al guardarse o cargarse desde el SII (ingreso + IVA débito + cuenta por cobrar)."
            : "Al contabilizar se genera el asiento (4.2). Solo se edita en borrador."
        }
      />
      <DocumentosVentaLista
        empresaId={empresaId}
        clase={clase}
        filtroEstado={estado ?? ""}
        documentos={documentos.map((d) => ({
          id: d.id,
          numeroInterno: d.numeroInterno,
          clase: d.clase,
          tipoDocumento: tipoNombre.get(d.tipoDocumentoId) ?? "—",
          folio: d.folio,
          cliente: clienteNombre.get(d.terceroId) ?? "—",
          terceroId: d.terceroId,
          fechaEmision: d.fechaEmision,
          montoTotal: d.montoTotal,
          estado: d.estado,
        }))}
        tiposDocumento={tiposDoc
          .filter((t) => t.tipoOperacion === "Venta" || t.tipoOperacion === "Ambos")
          .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}` }))}
        clientes={terceros
          .filter((t) => t.tipoTercero === "Cliente" && t.activo)
          .map((t) => ({ id: t.id, label: t.razonSocial }))}
      />
    </>
  );
}
