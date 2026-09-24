import { logoutAction } from "@/lib/actions/auth";
import type { ColorScheme } from "@/lib/color-scheme";
import { ThemeToggle } from "@/components/theme-toggle";

/** Barra superior compacta para celular/tablet (`<lg`) — reemplaza a `MenuBar`. La
 * navegación vive en `MobileTabBar` (abajo), no acá, para no duplicar el punto de entrada. */
export function MobileTopBar({
  razonSocial,
  userName,
  scheme,
}: {
  razonSocial: string;
  userName: string;
  scheme: ColorScheme;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 bg-chrome px-3 text-chrome-foreground">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">{razonSocial}</p>
      </div>
      <ThemeToggle scheme={scheme} className="size-11 text-chrome-foreground hover:bg-white/10" />
      <form action={logoutAction}>
        <button
          type="submit"
          title={`Cerrar sesión (${userName})`}
          aria-label="Cerrar sesión"
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-sm font-medium text-chrome-foreground hover:bg-white/10"
        >
          {userName.charAt(0).toUpperCase() || "?"}
        </button>
      </form>
    </div>
  );
}
