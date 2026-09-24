import type { NextAuthConfig } from "next-auth";

/**
 * Config "edge-safe": sin providers ni imports a @erp/db (que usa `ws`/Node APIs).
 * La usa `middleware.ts` para validar la cookie de sesión sin tocar la base de datos
 * en cada request — el patrón recomendado por Auth.js v5 cuando el provider real
 * (Credentials, en `auth.ts`) solo puede correr en runtime Node.
 */
export default {
  // Self-hosted (no es Vercel): Auth.js no confía en el Host header por defecto.
  // Necesario tanto aquí (proxy.ts) como en auth.ts (heredan de este config).
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const logueado = !!auth?.user;
      const { pathname } = nextUrl;
      const requiereSesion =
        pathname.startsWith("/admin") ||
        pathname.startsWith("/panel") ||
        pathname.startsWith("/superadmin");
      if (!requiereSesion) return true;
      return logueado;
    },
  },
} satisfies NextAuthConfig;
