/**
 * Adaptador del SII por **Certificado Digital** (autenticación mutua TLS con el
 * `.pfx`/`.p12` en el handshake, sin RUT/Clave Tributaria). Módulo solo servidor.
 *
 * ⚠️ El login por certificado del portal del SII **no es una API oficial documentada**.
 * Confirmado en vivo (HAR real) el flujo completo:
 *  1. GET a `IngresoCertificado.html` (con el `referencia` de destino en la query, sin
 *     encodear) — devuelve un `<form>` cuyo `ACTION` apunta al servidor real de login.
 *     Ese servidor **no es fijo**: el SII observado en vivo usó `herculesr.sii.cl`, no
 *     `zeusr.sii.cl` (que sí es el servidor para el login por Clave Tributaria). Por eso
 *     no se puede hardcodear: hay que leerlo del formulario en cada login.
 *  2. POST (con el certificado en el handshake TLS) a esa URL + `?<referencia>`, con
 *     body `referencia=<referencia URL-encodeada>`. El RUT del titular lo entrega el
 *     certificado — no se manda como parámetro.
 *  3. Si el titular representa a terceros, la respuesta es la pantalla "Escoja cómo
 *     desea ingresar"; confirmado en vivo que basta seguir el link "Continuar" (operar
 *     a nombre propio) — el RCV de un RUT representado igual se pudo pedir después sin
 *     pasar por "Cambiar a Representar". Si el titular no representa a nadie, el SII
 *     puede saltarse esta pantalla directamente.
 * Los puntos aún sin confirmar están marcados con `// VALIDAR:`.
 */
import { request } from "node:https";
import { SiiSesionCookieClient } from "./sesion-rcv";
import { pfxAPem } from "./pkcs12";

const IDENTIFICACION_URL = "https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoCertificado.html";
const REFERENCIA = "https://misiir.sii.cl/cgi_misii/siihome.cgi";
const MAX_REDIRECTS = 5;

type RespuestaHttp = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

function pedir(
  url: URL,
  opts: { key: string; cert: string; ca?: string[]; cookie?: string; method?: "GET" | "POST"; body?: string },
): Promise<RespuestaHttp> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: opts.method ?? "GET",
        key: opts.key,
        cert: opts.cert,
        ca: opts.ca,
        headers: {
          "User-Agent": "Mozilla/5.0 (ERP-SIG)",
          ...(opts.cookie ? { Cookie: opts.cookie } : {}),
          ...(opts.body
            ? {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(opts.body),
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

export class SiiCertificadoClient extends SiiSesionCookieClient {
  constructor(
    rut: string,
    /** RUT de la persona dueña del certificado. Ya no se envía en el login (lo entrega
     * el certificado vía TLS); se conserva solo como dato informativo de la credencial. */
    private readonly rutTitular: string,
    private readonly certificadoBase64: string,
    private readonly certPass: string,
  ) {
    super(rut);
    void this.rutTitular;
  }

  protected etiquetaMetodo(): string {
    return "Certificado Digital";
  }

  protected async obtenerCookies(): Promise<string> {
    // node-forge decodifica el .pfx en JS puro: OpenSSL 3 (Node 20+) ya no soporta el
    // cifrado "legacy" (RC2-40/3DES) con el que se exportan muchos certificados
    // chilenos, y `https.request({ pfx })` falla ahí con `Unsupported PKCS12 PFX data`.
    const { key, cert, ca } = pfxAPem(this.certificadoBase64, this.certPass);
    const credencial = { key, cert, ca: ca.length > 0 ? ca : undefined };
    const cookies = new Map<string, string>();

    // Sigue redirecciones 3xx (con GET, sin reenviar el body) acumulando cookies en
    // cada salto — el SII a veces resuelve un paso con contenido directo y otras con
    // un redirect, y no hay forma de saber cuál sin probarlo en vivo.
    const paso = async (url: URL, opts: { method?: "GET" | "POST"; body?: string }): Promise<RespuestaHttp> => {
      let actual = url;
      let siguienteOpts: { method?: "GET" | "POST"; body?: string } = opts;
      let ultima: RespuestaHttp | null = null;
      for (let i = 0; i < MAX_REDIRECTS; i++) {
        const cookieHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
        const res = await pedir(actual, { ...credencial, cookie: cookieHeader, ...siguienteOpts });
        ultima = res;
        for (const c of ([] as string[]).concat((res.headers["set-cookie"] as string[]) ?? [])) {
          const [par] = c.split(";");
          const [k, v] = par!.split("=");
          if (k && v !== undefined) cookies.set(k, v);
        }
        const location = res.headers.location as string | undefined;
        if (res.status >= 300 && res.status < 400 && location) {
          actual = new URL(location, actual);
          siguienteOpts = {};
          continue;
        }
        break;
      }
      return ultima!;
    };

    // 1) Página que arma el POST de login — su <form ACTION> dice a qué servidor pegarle
    // (varía entre logins, ej. herculesr.sii.cl); no se puede asumir un host fijo.
    const paginaIngreso = await paso(new URL(`${IDENTIFICACION_URL}?${REFERENCIA}`), {});
    const accion = paginaIngreso.body.match(/ACTION="([^"]+)"/i)?.[1];
    if (!accion) {
      const snippet = paginaIngreso.body.replace(/\s+/g, " ").slice(0, 200);
      throw new Error(
        `El SII no devolvió el formulario de login con certificado (status ${paginaIngreso.status}). ` +
          `Revisa el certificado y la contraseña.${snippet ? ` Respuesta: ${snippet}` : ""}`,
      );
    }

    // 2) Login real: el certificado en el handshake TLS identifica al titular.
    let ultima = await paso(new URL(`${accion}?${REFERENCIA}`), {
      method: "POST",
      body: `referencia=${encodeURIComponent(REFERENCIA)}`,
    });

    // 3) Si el titular representa a terceros, el SII muestra "Escoja cómo desea
    // ingresar"; seguimos "Continuar" (operar a nombre propio) — confirmado en vivo que
    // el RCV de un RUT representado se puede pedir igual sin "Cambiar a Representar".
    // VALIDAR: si en algún caso el RCV de un RUT representado SÍ exige pasar por
    // "Cambiar a Representar" en vez de "Continuar", falta implementar esa rama.
    const continuar = ultima.body.match(/<a href="([^"]+)"[^>]*>\s*Continuar\s*<\/a>/i)?.[1];
    if (continuar) {
      ultima = await paso(new URL(continuar, new URL(accion)), {});
    }

    // Exigimos la cookie TOKEN puntualmente (no solo "alguna cookie"): es la que
    // sesion-rcv.ts reusa como `conversationId` del facade del RCV, y sin ella el login
    // quedó incompleto aunque se hayan juntado otras cookies de tracking en el camino.
    if (!cookies.has("TOKEN")) {
      const snippet = ultima.body.replace(/\s+/g, " ").slice(0, 300);
      throw new Error(
        `El login con certificado no completó la sesión del SII (status ${ultima.status}, ` +
          `cookies obtenidas: ${[...cookies.keys()].join(", ") || "ninguna"}). ` +
          `Revisa el certificado y la contraseña.${snippet ? ` Respuesta: ${snippet}` : ""}`,
      );
    }
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}
