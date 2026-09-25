import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Guías de capacitación: cada entrada apunta al .md de referencia del módulo
 * (raíz del monorepo, misma fuente que usa el equipo de desarrollo) para no
 * duplicar el contenido — la sección solo lo muestra dentro del sistema.
 */
export const CAPACITACION_DOCS = [
  {
    slug: "activo-fijo",
    titulo: "Módulo de Activo Fijo",
    descripcion: "Ciclo de vida completo, depreciación, régimen tributario chileno y corrección monetaria.",
    archivo: "modulo-activo-fijo.md",
  },
  {
    slug: "bancos",
    titulo: "Módulo de Bancos",
    descripcion: "Plantillas de cartola por banco, importación con validaciones y carga manual de movimientos.",
    archivo: "modulo-bancos.md",
  },
] as const;

export type CapacitacionDoc = (typeof CAPACITACION_DOCS)[number];

export function buscarCapacitacionDoc(slug: string): CapacitacionDoc | undefined {
  return CAPACITACION_DOCS.find((d) => d.slug === slug);
}

export async function leerCapacitacionDoc(archivo: string): Promise<string> {
  const ruta = path.resolve(process.cwd(), "../..", archivo);
  return readFile(ruta, "utf-8");
}
