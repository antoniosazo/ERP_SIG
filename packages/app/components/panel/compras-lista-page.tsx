import type { DocumentoCompraTipo } from "@erp/shared";
import { listarDocumentosCompra, listarTerceros, listarTiposDocumento } from "@erp/db";
import { DocumentosCompraLista } from "@/components/panel/documentos-compra-lista";
import { COMPRA_TIPO_META } from "@/lib/compras";
import { TypographyHeading } from "@/components/ui/typography";

/** Lista de documentos de compra de un tipo (Pedido / Factura / NC / ND). */
export async function ComprasListaPage({
  empresaId,
  docTipo,
  estado,
}: {
  empresaId: string;
  docTipo: DocumentoCompraTipo;
  estado?: string;
}) {
  const meta = COMPRA_TIPO_META[docTipo];
  const [documentos, terceros, tiposDoc] = await Promise.all([
    listarDocumentosCompra(empresaId, { docTipo, estado: estado || undefined }),
    listarTerceros(empresaId),
    listarTiposDocumento(),
  ]);

  const tipoNombre = new Map(tiposDoc.map((t) => [t.id, t.nombre]));
  const provNombre = new Map(terceros.map((t) => [t.id, t.razonSocial]));

  return (
    <>
      <TypographyHeading
        title={meta.titulo}
        description={
          meta.contabiliza
            ? "Al contabilizar se genera el asiento (gasto + IVA crédito + cuenta por pagar)."
            : "El pedido controla el saldo pendiente por línea; se trae a una factura para contabilizar."
        }
      />
      <DocumentosCompraLista
        empresaId={empresaId}
        docTipo={docTipo}
        filtroEstado={estado ?? ""}
        documentos={documentos.map((d) => ({
          id: d.id,
          numeroInterno: d.numeroInterno,
          tipoDocumento: tipoNombre.get(d.tipoDocumentoId) ?? "—",
          folio: d.folio,
          proveedor: provNombre.get(d.terceroId) ?? "—",
          fechaEmision: d.fechaEmision,
          montoTotal: d.montoTotal,
          estado: d.estado,
        }))}
        tiposDocumento={tiposDoc
          .filter((t) => t.tipoOperacion === "Compra" || t.tipoOperacion === "Ambos")
          .map((t) => ({ id: t.id, label: `${t.codigoSii} — ${t.nombre}` }))}
        proveedores={terceros
          .filter((t) => t.tipoTercero === "Proveedor" && t.activo && !t.bloqueado)
          .map((t) => ({ id: t.id, label: t.razonSocial }))}
      />
    </>
  );
}
