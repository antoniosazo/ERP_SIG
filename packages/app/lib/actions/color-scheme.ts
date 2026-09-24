"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COLOR_SCHEME_COOKIE, type ColorScheme } from "@/lib/color-scheme";

/** Guarda el tema claro/oscuro en una cookie y refresca el layout. Sin requireSession: también aplica en /login. */
export async function setColorSchemeAction(next: ColorScheme): Promise<void> {
  const value: ColorScheme = next === "dark" ? "dark" : "light";
  (await cookies()).set(COLOR_SCHEME_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
