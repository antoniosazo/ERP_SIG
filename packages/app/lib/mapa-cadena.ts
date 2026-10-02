import { obtenerMapaRelaciones, type TablaMapa } from "@erp/db";
import { mapaADTO } from "@/lib/mapa-dto";
import { disponerGrafo, type NodoMapaDTO } from "@/lib/mapa-grafo";

const TABLAS_CADENA = new Set<TablaMapa>(["documentos_compra", "documentos_venta", "pagos"]);

/**
 * Etapas del proceso a las que pertenece un documento (orden de compra → entrada → factura → pago),
 * sin asientos ni cheques. Devuelve null si el documento está solo. Nunca lanza: es un adorno de la pantalla.
 */
export async function cadenaDeDocumentos(empresaId: string, tabla: TablaMapa, id: string): Promise<NodoMapaDTO[][] | null> {
  try {
    const mapa = await obtenerMapaRelaciones(empresaId, tabla, id);
    if (!mapa) return null;
    const dto = mapaADTO(empresaId, mapa);
    const nodos = dto.nodos.filter((n) => TABLAS_CADENA.has(n.tabla));
    if (nodos.length < 2) return null;
    const claves = new Set(nodos.map((n) => n.clave));
    const d = disponerGrafo({ nodos, aristas: dto.aristas.filter((a) => claves.has(a.desde) && claves.has(a.hasta)) });
    const etapas = new Map<number, NodoMapaDTO[]>();
    for (const n of nodos) {
      const capa = d.posiciones.get(n.clave)!.capa;
      etapas.set(capa, [...(etapas.get(capa) ?? []), n]);
    }
    return [...etapas.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, ns]) => ns.sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "") || a.numero.localeCompare(b.numero)));
  } catch {
    return null;
  }
}
