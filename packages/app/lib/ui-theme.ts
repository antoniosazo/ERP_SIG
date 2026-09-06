import { cookies } from "next/headers";

export type UiTheme = "classic" | "moderno";

export const UI_COOKIE = "erp-ui";
export const UI_THEME_DEFAULT: UiTheme = "classic";

/** Lee el tema de UI de la cookie (server). Por defecto: Clásico. */
export async function leerUiTheme(): Promise<UiTheme> {
  const value = (await cookies()).get(UI_COOKIE)?.value;
  return value === "moderno" ? "moderno" : "classic";
}
