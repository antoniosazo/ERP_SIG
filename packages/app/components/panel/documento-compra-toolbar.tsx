import Link from "next/link";
import { PrinterIcon } from "lucide-react";
import type { ConfigFormularioDoc } from "@erp/shared";
import {
  historialDocumentoCompraAction,
  verAsientoCompraAction,
} from "@/lib/actions/compras";
import { AsientoDialog } from "@/components/panel/asiento-dialog";
import { ConfigFormularioDialog } from "@/components/panel/config-formulario-dialog";
import { HistorialDocumentoDialog } from "@/components/panel/historial-documento-dialog";
import { ReclamoSiiDialog } from "@/components/panel/reclamo-sii-dialog";
import { TraerDesdeDialog } from "@/components/panel/traer-desde-dialog";
import { Button } from "@/components/ui/button";
import { VerFacturaBoton } from "@/components/panel/factura-vista";
import type { FacturaDatos } from "@/lib/factura-vista";

type LineaPendiente = {
  id: string;
  numeroLinea: number;
  glosa: string | null;
  cantidadPendiente: number;
  precioUnitario: number;
};

/**
 * Barra de herramientas de un documento de compra: configurar campos, ver asiento,
 * historial e impresión. Para un pedido abierto agrega "Traer a factura".
 */
export function DocumentoCompraToolbar({
  empresaId,
  factura,
  docId,
  docTipo,
  estado,
  config,
  lineasPendientes,
}: {
  empresaId: string;
  factura: FacturaDatos;
  docId: string;
  docTipo: string;
  estado: string;
  config: ConfigFormularioDoc;
  lineasPendientes: LineaPendiente[];
}) {
  const generaAsiento =
    docTipo === "factura" ||
    docTipo === "nota_credito" ||
    docTipo === "nota_debito" ||
    docTipo === "entrada_mercaderia";
  const pedidoAbierto = docTipo === "pedido" && estado === "abierto" && lineasPendientes.length > 0;
  const grpoPorFacturar =
    docTipo === "entrada_mercaderia" && estado === "contabilizado" && lineasPendientes.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <ConfigFormularioDialog config={config} />
      {generaAsiento && (
        <AsientoDialog empresaId={empresaId} docId={docId} verAsiento={verAsientoCompraAction} />
      )}
      <HistorialDocumentoDialog
        empresaId={empresaId}
        docId={docId}
        historial={historialDocumentoCompraAction}
      />
      {docTipo === "factura" && <ReclamoSiiDialog empresaId={empresaId} docId={docId} />}
      {pedidoAbierto && (
        <>
          <TraerDesdeDialog
            empresaId={empresaId}
            documentoBaseId={docId}
            lineas={lineasPendientes}
            docTipoDestino="entrada_mercaderia"
            boton="Traer a recepción"
            titulo="Traer líneas del pedido a una Entrada de Mercadería"
          />
          <TraerDesdeDialog
            empresaId={empresaId}
            documentoBaseId={docId}
            lineas={lineasPendientes}
            docTipoDestino="factura"
            boton="Traer a factura"
            titulo="Traer líneas del pedido a una factura"
          />
        </>
      )}
      {grpoPorFacturar && (
        <TraerDesdeDialog
          empresaId={empresaId}
          documentoBaseId={docId}
          lineas={lineasPendientes}
          docTipoDestino="factura"
          boton="Traer a factura"
          titulo="Traer líneas de la recepción a una factura"
        />
      )}
      <VerFacturaBoton f={factura} />
      <Button
        asChild
        type="button"
        variant="outline"
        size="icon-sm"
        title="Imprimir documento"
        aria-label="Imprimir documento"
      >
        <Link
          href={`/panel/${empresaId}/compras/documentos/${docId}/imprimir`}
          target="_blank"
          rel="noopener"
        >
          <PrinterIcon />
        </Link>
      </Button>
    </div>
  );
}
