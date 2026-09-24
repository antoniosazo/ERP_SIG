import type { Metadata } from "next";
import { Figtree, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { leerColorScheme } from "@/lib/color-scheme";
import { leerUiTheme } from "@/lib/ui-theme";
import "./globals.css";

// Geist queda enganchada al token Tailwind `font-sans` (--font-sans).
const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Geist Mono disponible como `font-mono` (--font-mono).
const fontMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Figtree es la fuente de UI por defecto (todo el texto visible via className en el <body>).
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tessora ERP",
  description: "Administración de firmas y empresas cliente",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [ui, scheme] = await Promise.all([leerUiTheme(), leerColorScheme()]);
  return (
    <html lang="es" data-ui={ui} className={cn("h-full", scheme === "dark" && "dark")}>
      <body
        className={cn(
          fontSans.variable,
          fontMono.variable,
          figtree.className,
          "min-h-full flex flex-col antialiased",
        )}
      >
        {children}
        <Toaster scheme={scheme} />
      </body>
    </html>
  );
}
