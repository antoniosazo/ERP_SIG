import type { DefaultSession } from "next-auth";

type EmpresaAsignada = { empresaId: string; rol: string };

declare module "next-auth" {
  interface User {
    firmaContableId: string;
    esAdminFirma: boolean;
    empresas: EmpresaAsignada[];
  }

  interface Session {
    user: {
      id: string;
      firmaContableId: string;
      esAdminFirma: boolean;
      empresas: EmpresaAsignada[];
    } & DefaultSession["user"];
  }
}

// No se aumenta el tipo `JWT` (@auth/core/jwt): en next-auth 5.0.0-beta.32 ese módulo
// solo re-exporta desde "@auth/core/jwt" y la interfaz real no queda mergeada por esa vía
// (queda como `Record<string, unknown>` de todos modos). Por eso en auth.ts se leen los
// campos custom del token con un cast explícito en el callback `session` en vez de
// depender de esta declaración.
