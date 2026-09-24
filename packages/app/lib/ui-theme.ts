import { cookies } from "next/headers";

export type UiTheme = "classic" | "moderno";

export const UI_COOKIE = "erp-ui";
export const UI_THEME_DEFAULT: UiTheme = "moderno";

/**
 * Lee el tema de UI de la cookie (server). Por defecto: Moderno — el sistema de
 * diseño unificado (sep 2026, ver globals.css) es ahora la referencia; Clásico
 * queda disponible para quien ya lo eligió explícitamente o prefiere la grilla
 * densa en pantallas de documentos.
 */
export async function leerUiTheme(): Promise<UiTheme> {
  const value = (await cookies()).get(UI_COOKIE)?.value;
  return value === "classic" ? "classic" : "moderno";
}
