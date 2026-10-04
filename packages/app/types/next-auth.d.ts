import type { DefaultSession } from "next-auth";

type EmpresaAsignada = { empresaId: string; rol: string };
type FirmaAcceso = { id: string; nombre: string; esAdminFirma: boolean };

declare module "next-auth" {
  interface User {
    esSuperAdmin: boolean;
    /** Firmas a las que entra la cuenta (membresías vigentes de firmas activas). */
    firmas: FirmaAcceso[];
    /** Rol por empresa en cada una de esas firmas. */
    empresasPorFirma: Record<string, EmpresaAsignada[]>;
  }

  interface Session {
    user: {
      id: string;
      /** Firma con la que se trabaja ahora; vacía mientras quien tiene varias aún no elige. */
      firmaContableId: string;
      firmaNombre: string | null;
      /** Nombre de la firma abierta por un superadmin (lo avisa un banner); null para el resto. */
      firmaVistaNombre: string | null;
      /** Todas las firmas a las que entra, para elegir o cambiar. */
      firmas: FirmaAcceso[];
      /** En la firma activa. */
      esAdminFirma: boolean;
      esSuperAdmin: boolean;
      /** Rol por empresa en la firma activa. */
      empresas: EmpresaAsignada[];
    } & DefaultSession["user"];
  }
}

// No se aumenta el tipo `JWT` (@auth/core/jwt): en next-auth 5.0.0-beta.32 ese módulo
// solo re-exporta desde "@auth/core/jwt" y la interfaz real no queda mergeada por esa vía
// (queda como `Record<string, unknown>` de todos modos). Por eso en auth.ts se leen los
// campos custom del token con un cast explícito en el callback `session` en vez de
// depender de esta declaración.
