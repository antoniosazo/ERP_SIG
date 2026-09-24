import { cookies } from "next/headers";

export type ColorScheme = "light" | "dark";

export const COLOR_SCHEME_COOKIE = "erp-scheme";
export const COLOR_SCHEME_DEFAULT: ColorScheme = "light";

/** Lee el tema claro/oscuro de la cookie (server). Por defecto: claro. */
export async function leerColorScheme(): Promise<ColorScheme> {
  const value = (await cookies()).get(COLOR_SCHEME_COOKIE)?.value;
  return value === "dark" ? "dark" : "light";
}
