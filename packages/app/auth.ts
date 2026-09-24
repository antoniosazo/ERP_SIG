import { verificarCredenciales } from "@erp/db";
import { loginSchema } from "@erp/shared";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const usuario = await verificarCredenciales(parsed.data.email, parsed.data.password);
        if (!usuario) return null;

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.email,
          firmaContableId: usuario.firmaContableId,
          esAdminFirma: usuario.esAdminFirma,
          esSuperAdmin: usuario.esSuperAdmin,
          empresas: usuario.empresas,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.firmaContableId = user.firmaContableId;
        token.esAdminFirma = user.esAdminFirma;
        token.esSuperAdmin = user.esSuperAdmin;
        token.empresas = user.empresas;
      }
      return token;
    },
    session({ session, token }) {
      // `token.xxx` sigue tipado `unknown` (JWT extiende Record<string, unknown> en
      // @auth/core) aunque la propiedad se haya escrito en el callback `jwt` de arriba —
      // el cast es correcto porque nosotros mismos garantizamos esa forma ahí.
      session.user.id = token.sub ?? "";
      session.user.firmaContableId = token.firmaContableId as string;
      session.user.esAdminFirma = token.esAdminFirma as boolean;
      session.user.esSuperAdmin = token.esSuperAdmin as boolean;
      session.user.empresas = token.empresas as { empresaId: string; rol: string }[];
      return session;
    },
  },
});
