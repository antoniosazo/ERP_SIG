/**
 * Adaptador del SII por **Clave Tributaria**. Módulo solo servidor.
 *
 * ⚠️ El login del portal del SII **no es una API oficial documentada** y cambia sin
 * aviso. Hay que validarlo en vivo (primero contra certificación). Los puntos a
 * verificar están marcados con `// VALIDAR:`.
 */
import { partesRut, SiiSesionCookieClient } from "./sesion-rcv";

const LOGIN_URL = "https://zeusr.sii.cl/cgi_AUT2000/CAutInicio.cgi";

export class SiiClaveClient extends SiiSesionCookieClient {
  constructor(
    rut: string,
    private readonly clave: string,
    /** RUT con el que se hace login cuando difiere del RUT de la empresa (mandatario
     * operando con su propia Clave Tributaria). El RCV se sigue pidiendo para `rut`. */
    private readonly rutTitular: string = rut,
  ) {
    super(rut);
  }

  protected etiquetaMetodo(): string {
    return "Clave Tributaria";
  }

  protected async obtenerCookies(): Promise<string> {
    const { cuerpo, dv } = partesRut(this.rutTitular);
    const body = new URLSearchParams({
      referencia: "https://misiir.sii.cl/cgi_misii/siihome.cgi",
      "411": "",
      rutcntr: `${cuerpo}${dv}`,
      rut: cuerpo,
      dv,
      clave: this.clave,
    });
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (ERP-SIG)",
      },
      body: body.toString(),
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() ?? [];
    const cookieHeader = set.map((c) => c.split(";")[0]).join("; ");
    // VALIDAR: el SII devuelve TOKEN + NETSCAPE_* al loguear OK; con clave mala reenvía
    // HTML de error sin esas cookies.
    if (!cookieHeader.includes("TOKEN") && !/s2=/i.test(cookieHeader)) {
      const texto = (await res.text().catch(() => ""))
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300);
      throw new Error(
        `El SII rechazó el login con RUT/Clave (status ${res.status}). ` +
          `${texto ? `Respuesta del SII: ${texto}` : "Revisa las credenciales y el ambiente."}`,
      );
    }
    // VALIDAR: cuando `rutTitular` representa a terceros, `certificado.ts` (confirmado
    // en vivo) debe seguir un link "Continuar" para completar la sesión — no está
    // confirmado si el login por Clave Tributaria pasa por la misma pantalla intermedia
    // ("Escoja cómo desea ingresar") o si entrega la sesión completa directo en este POST.
    return cookieHeader;
  }
}
