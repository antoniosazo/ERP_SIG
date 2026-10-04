import {
  esSuperAdminVigente,
  obtenerFirmaContable,
  registrarResolverFirma,
  sesionVigente,
  verificarCredenciales,
} from "@erp/db";
import { loginSchema } from "@erp/shared";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import authConfig from "./auth.config";
import { COOKIE_FIRMA_ACTIVA, verificarFirmaActiva } from "@/lib/firma-activa";

const VERIFICAR_SESION_CADA_MS = 5 * 60 * 1000;

type FirmaAcceso = { id: string; nombre: string; esAdminFirma: boolean };
type EmpresaAsignada = { empresaId: string; rol: string };

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
          esSuperAdmin: usuario.esSuperAdmin,
          firmas: usuario.firmas,
          empresasPorFirma: usuario.empresasPorFirma,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.esSuperAdmin = user.esSuperAdmin;
        token.firmas = user.firmas;
        token.empresasPorFirma = user.empresasPorFirma;
        token.verificadaEn = Date.now();
        return token;
      }
      // Cada tanto se confirma contra la plataforma que la cuenta siga vigente y se refrescan sus
      // firmas, permisos y roles. Una sesión de un usuario desactivado o sin ninguna firma vigente
      // se cierra (null) en vez de romper cada página. Un token del formato anterior (sin firmas)
      // se refresca de inmediato.
      const verificadaEn = typeof token.verificadaEn === "number" ? token.verificadaEn : 0;
      const formatoVigente = Array.isArray(token.firmas);
      if (!token.sub || (formatoVigente && Date.now() - verificadaEn < VERIFICAR_SESION_CADA_MS)) return token;
      try {
        const acceso = await sesionVigente(token.sub);
        if (!acceso) return null;
        token.esSuperAdmin = acceso.esSuperAdmin;
        token.firmas = acceso.firmas;
        token.empresasPorFirma = acceso.empresasPorFirma;
        token.verificadaEn = Date.now();
      } catch {
        // Si la plataforma o la base de una firma no responden, no se cierra la sesión por eso.
        if (!formatoVigente) return null;
      }
      return token;
    },
    async session({ session, token }) {
      // `token.xxx` sigue tipado `unknown` (JWT extiende Record<string, unknown> en
      // @auth/core) aunque la propiedad se haya escrito en el callback `jwt` de arriba —
      // el cast es correcto porque nosotros mismos garantizamos esa forma ahí.
      const u = session.user;
      u.id = token.sub ?? "";
      let esSuperAdmin = !!token.esSuperAdmin;
      const firmas = Array.isArray(token.firmas) ? (token.firmas as FirmaAcceso[]) : [];
      const empresasPorFirma = (token.empresasPorFirma ?? {}) as Record<string, EmpresaAsignada[]>;

      // Firma activa: la que eligió (cookie firmada, comprobada contra sus firmas en cada petición).
      // Un superadmin puede abrir además una firma de la que no es miembro. Quien tiene una sola
      // firma entra directo; el superadmin siempre elige desde Firmas.
      let activa: { id: string; nombre: string } | null = null;
      const elegida = verificarFirmaActiva((await cookies()).get(COOKIE_FIRMA_ACTIVA)?.value, u.id);
      if (elegida) {
        const propia = firmas.find((f) => f.id === elegida);
        if (propia) activa = { id: propia.id, nombre: propia.nombre };
        else if (esSuperAdmin) {
          if (await esSuperAdminVigente(u.id)) {
            const firma = await obtenerFirmaContable(elegida);
            if (firma?.estado === "Activa" && firma.estadoBase === "lista") activa = { id: firma.id, nombre: firma.razonSocial };
          } else {
            esSuperAdmin = false;
          }
        }
      }
      if (!activa && !esSuperAdmin && firmas.length === 1) activa = { id: firmas[0]!.id, nombre: firmas[0]!.nombre };

      const membresia = activa ? firmas.find((f) => f.id === activa.id) : undefined;
      u.esSuperAdmin = esSuperAdmin;
      u.firmas = firmas;
      u.firmaContableId = activa?.id ?? "";
      u.firmaNombre = activa?.nombre ?? null;
      u.firmaVistaNombre = esSuperAdmin && activa ? activa.nombre : null;
      u.esAdminFirma = !!activa && (esSuperAdmin || !!membresia?.esAdminFirma);
      u.empresas = activa ? (empresasPorFirma[activa.id] ?? []) : [];
      return session;
    },
  },
});

// `db` (@erp/db) consulta la firma activa de la petición, incluida la que abrió un superadmin.
registrarResolverFirma(async () => (await auth())?.user?.firmaContableId || null);
