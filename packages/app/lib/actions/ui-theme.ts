"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-helpers";
import { UI_COOKIE, type UiTheme } from "@/lib/ui-theme";

/** Guarda el tema de UI (Clásico / Moderno) en una cookie y refresca el layout. */
export async function setUiThemeAction(next: UiTheme): Promise<void> {
  await requireSession();
  const value: UiTheme = next === "moderno" ? "moderno" : "classic";
  (await cookies()).set(UI_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
