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
import { MapaRelacionesDialog } from "@/components/panel/mapa-relaciones-dialog";
import { ReclamoSiiDialog } from "@/components/panel/reclamo-sii-dialog";
import { TraerDesdeDialog, type DestinoTraer } from "@/components/panel/traer-desde-dialog";
import { Button } from "@/components/ui/button";
import { VerFacturaBoton } from "@/components/panel/factura-vista";
import type { FacturaDatos } from "@/lib/factura-vista";

type LineaPendiente = {
  id: string;
  numeroLinea: number;
  glosa: string | null;
  cantidadPendiente: number;
  precioUnitario: number;
  esInventario: boolean;
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
  puedeVerContabilidad,
  tiposFactura,
}: {
  empresaId: string;
  factura: FacturaDatos;
  docId: string;
  docTipo: string;
  estado: string;
  config: ConfigFormularioDoc;
  lineasPendientes: LineaPendiente[];
  puedeVerContabilidad: boolean;
  tiposFactura: { id: string; label: string }[];
}) {
  const generaAsiento =
    docTipo === "factura" ||
    docTipo === "nota_credito" ||
    docTipo === "nota_debito" ||
    docTipo === "entrada_mercaderia";
  const lineasInventario = lineasPendientes.filter((l) => l.esInventario);
  const lineasFacturablesDirectas = lineasPendientes.filter((l) => !l.esInventario);
  const pedidoAbierto = docTipo === "pedido" && estado === "abierto" && lineasPendientes.length > 0;
  const grpoPorFacturar =
    docTipo === "entrada_mercaderia" && estado === "contabilizado" && lineasPendientes.length > 0;
  const pl = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const destinosPedido: DestinoTraer[] = [
    ...(lineasInventario.length > 0
      ? [{
          docTipoDestino: "entrada_mercaderia" as const,
          etiqueta: "Entrada de mercadería",
          detalle: `${pl(lineasInventario.length, "línea de inventario", "líneas de inventario")} que llegan a bodega`,
          lineas: lineasInventario,
        }]
      : []),
    ...(lineasFacturablesDirectas.length > 0
      ? [{
          docTipoDestino: "factura" as const,
          etiqueta: "Factura de compra",
          detalle: `${pl(lineasFacturablesDirectas.length, "línea", "líneas")} que no son de inventario (servicios, gastos)`,
          lineas: lineasFacturablesDirectas,
          tiposDocumento: tiposFactura,
        }]
      : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      {puedeVerContabilidad && pedidoAbierto && destinosPedido.length > 0 && (
        <TraerDesdeDialog
          empresaId={empresaId}
          documentoBaseId={docId}
          destinos={destinosPedido}
          boton={destinosPedido.length > 1 ? "Continuar con…" : destinosPedido[0]!.docTipoDestino === "factura" ? "Traer a factura" : "Traer a entrada de mercadería"}
          titulo={destinosPedido.length > 1 ? "Continuar la orden de compra" : `Crear ${destinosPedido[0]!.etiqueta.toLowerCase()} desde la orden`}
        />
      )}
      {puedeVerContabilidad && grpoPorFacturar && (
        <TraerDesdeDialog
          empresaId={empresaId}
          documentoBaseId={docId}
          destinos={[{
            docTipoDestino: "factura",
            etiqueta: "Factura de compra",
            detalle: `${pl(lineasPendientes.length, "línea", "líneas")} de la entrada`,
            lineas: lineasPendientes,
            tiposDocumento: tiposFactura,
          }]}
          boton="Traer a factura"
          titulo="Crear factura desde la entrada de mercadería"
        />
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2" role="group" aria-label="Herramientas del documento">
        <ConfigFormularioDialog config={config} origen="compra" docTipo={docTipo} />
        {puedeVerContabilidad && generaAsiento && (
          <AsientoDialog empresaId={empresaId} docId={docId} verAsiento={verAsientoCompraAction} />
        )}
        {puedeVerContabilidad && (
          <HistorialDocumentoDialog
            empresaId={empresaId}
            docId={docId}
            historial={historialDocumentoCompraAction}
          />
        )}
        {puedeVerContabilidad && <MapaRelacionesDialog empresaId={empresaId} tabla="documentos_compra" id={docId} />}
        {puedeVerContabilidad && docTipo === "factura" && <ReclamoSiiDialog empresaId={empresaId} docId={docId} />}
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
    </div>
  );
}
