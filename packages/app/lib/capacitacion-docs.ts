/** Catálogo de las guías interactivas de capacitación para usuarios. */
export const CAPACITACION_DOCS = [
  {
    slug: "activo-fijo",
    titulo: "Activo fijo: guía de uso",
    descripcion: "Aprende a registrar activos, depreciarlos, gestionar sus movimientos y preparar el cierre anual.",
  },
  {
    slug: "bancos",
    titulo: "Bancos: guía de uso",
    descripcion: "Aprende a importar una cartola, revisar sus movimientos y resolver los mensajes más comunes.",
  },
] as const;

export type CapacitacionDoc = (typeof CAPACITACION_DOCS)[number];

export function buscarCapacitacionDoc(slug: string): CapacitacionDoc | undefined {
  return CAPACITACION_DOCS.find((d) => d.slug === slug);
}
