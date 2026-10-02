import type { MapaRelaciones } from "@erp/db";
import { rutaOrigen } from "@/lib/origen-asiento";
import type { MapaRelacionesDTO } from "@/lib/mapa-grafo";

/** Agrega a cada nodo la pantalla a la que abre y al socio su ficha. */
export function mapaADTO(empresaId: string, mapa: MapaRelaciones): MapaRelacionesDTO {
  return {
    ...mapa,
    socio: mapa.socio && { ...mapa.socio, href: `/panel/${empresaId}/maestros/terceros/${mapa.socio.id}` },
    nodos: mapa.nodos.map((n) => ({
      ...n,
      href:
        n.tabla === "activos_fijos"
          ? `/panel/${empresaId}/activos-fijos/activos/${n.id}`
          : rutaOrigen(empresaId, { origenTabla: n.tabla, origenId: n.id, pagoTipo: n.pagoTipo, anio: n.anio ?? undefined }),
    })),
  };
}
