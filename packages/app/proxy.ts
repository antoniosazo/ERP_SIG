import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

// Next.js 16 renombró "middleware" a "proxy". Next detecta el export por análisis
// estático simple, así que debe ser un `export const proxy = <identificador>` directo
// (no un patrón de destructuring en la misma línea del export).
export const proxy = auth;

export const config = {
  matcher: ["/admin/:path*", "/panel/:path*"],
};
