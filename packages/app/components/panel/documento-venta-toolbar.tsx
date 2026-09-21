import Link from "next/link";
import { PrinterIcon } from "lucide-react";
import type { ConfigFormularioDoc } from "@erp/shared";
import { AsientoDialog } from "@/components/panel/asiento-dialog";
import { ConfigFormularioDialog } from "@/components/panel/config-formulario-dialog";
import { HistorialDocumentoDialog } from "@/components/panel/historial-documento-dialog";
import { Button } from "@/components/ui/button";
import { VerFacturaBoton } from "@/components/panel/factura-vista";
import type { FacturaDatos } from "@/lib/factura-vista";

/**
 * Barra de herramientas del documento de venta (Factura / NC / ND): configurar campos,
 * ver asiento, historial de modificaciones e impresión. Pensada para sumar más acciones.
 */
export function DocumentoVentaToolbar({
  empresaId,
  docId,
  config,
  factura,
}: {
  empresaId: string;
  docId: string;
  config: ConfigFormularioDoc;
  factura: FacturaDatos;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <ConfigFormularioDialog config={config} />
      <AsientoDialog empresaId={empresaId} docId={docId} />
      <HistorialDocumentoDialog empresaId={empresaId} docId={docId} />
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
          href={`/panel/${empresaId}/ventas/documentos/${docId}/imprimir`}
          target="_blank"
          rel="noopener"
        >
          <PrinterIcon />
        </Link>
      </Button>
    </div>
  );
}
