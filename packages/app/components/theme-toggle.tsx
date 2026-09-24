"use client";

import { useState, useTransition } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { setColorSchemeAction } from "@/lib/actions/color-scheme";
import type { ColorScheme } from "@/lib/color-scheme";
import { cn } from "@/lib/utils";

/** Botón de ícono que alterna claro/oscuro. Aplica el cambio al toque (clase `dark` en
 * `<html>`) y recién después persiste la cookie, para que no haya que esperar al servidor. */
export function ThemeToggle({ scheme, className }: { scheme: ColorScheme; className?: string }) {
  const [actual, setActual] = useState(scheme);
  const [, startTransition] = useTransition();

  function alternar() {
    const siguiente: ColorScheme = actual === "dark" ? "light" : "dark";
    setActual(siguiente);
    document.documentElement.classList.toggle("dark", siguiente === "dark");
    startTransition(() => {
      setColorSchemeAction(siguiente);
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title={actual === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label="Alternar tema claro/oscuro"
      className={cn("flex items-center justify-center rounded-md transition-colors", className)}
    >
      {actual === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
  );
}
