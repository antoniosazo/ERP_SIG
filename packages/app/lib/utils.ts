import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Iniciales de un nombre completo para avatares ("Antonio Sazo" → "AS"). */
export function obtenerIniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const iniciales = [partes[0], partes[partes.length - 1]]
    .filter((p): p is string => !!p)
    .map((p) => p.charAt(0).toUpperCase());
  return [...new Set(iniciales)].join("") || "?";
}

/** Fecha en formato relativo corto ("Hace 2 días"), para timestamps recientes. */
export function formatearFechaRelativa(fechaIso: string): string {
  const diffMs = Date.now() - new Date(fechaIso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "Recién";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "Hace 1 día";
  if (diffD < 30) return `Hace ${diffD} días`;
  const diffMeses = Math.round(diffD / 30);
  if (diffMeses < 12) return `Hace ${diffMeses} ${diffMeses === 1 ? "mes" : "meses"}`;
  const diffAnios = Math.round(diffMeses / 12);
  return `Hace ${diffAnios} ${diffAnios === 1 ? "año" : "años"}`;
}
