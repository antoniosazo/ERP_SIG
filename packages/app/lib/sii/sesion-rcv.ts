/**
 * Base común para los adaptadores del SII que se autentican una vez (por Clave
 * Tributaria o por Certificado Digital) y reusan las cookies de sesión resultantes
 * para pedir el RCV al portal `consdcvinternetui`. Módulo solo servidor.
 *
 * ⚠️ Los endpoints y el formato de respuesta del portal RCV del SII **no son una API
 * oficial documentada** y cambian sin aviso. Hay que validarlo en vivo (primero contra
 * certificación). Los puntos a verificar están marcados con `// VALIDAR:`.
 */
import { randomUUID } from "node:crypto";
import type { SiiClient } from "./cliente";
import type { DocRcv, Periodo, ResultadoPrueba } from "./tipos";
import type { SiiEstadoRcv } from "@erp/shared";
import {
  ingresarAceptacionReclamoDoc,
  listarEventosHistDoc,
  type AccionDte,
  type EventoDte,
  type RespuestaSii,
} from "./reclamo-dte";

const RCV_BASE = "https://www4.sii.cl/consdcvinternetui/services/data/facadeService";
const RCV_REFERER = "https://www4.sii.cl/consdcvinternetui/";
const RCV_NAMESPACE = "cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService";
const ESTADOS: SiiEstadoRcv[] = ["REGISTRO", "PENDIENTE", "NO_INCLUIR", "RECLAMADO"];
const SESION_TTL_MS = 12 * 60 * 1000;

export function partesRut(rut: string): { cuerpo: string; dv: string } {
  const limpio = rut.replace(/[.\-]/g, "").toUpperCase();
  return { cuerpo: limpio.slice(0, -1), dv: limpio.slice(-1) };
}

/** El SII usa la cookie `TOKEN` de la sesión también como `conversationId` del facade RCV. */
function extraerToken(cookies: string): string {
  const m = cookies.match(/(?:^|;\s*)TOKEN=([^;]+)/);
  if (!m) throw new Error("La sesión del SII no trae cookie TOKEN; no se puede pedir el RCV.");
  return m[1]!;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function pick<T = unknown>(o: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (o[k] != null && o[k] !== "") return o[k] as T;
  }
  return undefined;
}

/** `2026-09-05` desde varias formas que devuelve el SII (con o sin hora al final). */
function fecha(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/); // dd-mm-yyyy[ hh:mm:ss]
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return v.slice(0, 10);
}

/**
 * `detTipoDoc` viene `null` en la respuesta real de `getDetalleCompra`/`getDetalleVenta`
 * — el SII no lo repite por fila porque cada llamada ya se pidió con un `codTipoDoc`
 * fijo. Por eso `tipoDte` se recibe aparte (el mismo con el que se pidió el detalle),
 * no se lee de la fila.
 */
function parseFilaRcv(f: Record<string, unknown>, estado: SiiEstadoRcv, tipoDte: number): DocRcv | null {
  const rutBody = pick<string>(f, "rutDoc", "detRutDoc", "rutContraparte", "rutEmisor");
  const dvDoc = pick<string>(f, "dvDoc", "detDvDoc");
  const folio = pick(f, "nroDoc", "detNroDoc", "folio", "nro");
  if (!rutBody || folio == null) return null;
  return {
    rutContraparte: dvDoc ? `${rutBody}-${dvDoc}` : String(rutBody),
    nombreContraparte: pick<string>(f, "rznSoc", "detRznSoc", "razonSocial", "nombreContraparte"),
    tipoDte,
    folio: String(folio),
    fechaEmision: fecha(pick(f, "fchDoc", "detFchDoc", "fechaEmision", "fchEmis")),
    fechaRecepcionSii: fecha(pick(f, "fecRecepcion", "detFecRecepcion", "fchRecepcion")),
    montoExento: num(pick(f, "mntExe", "detMntExe", "montoExento")),
    montoNeto: num(pick(f, "mntNeto", "detMntNeto", "montoNeto")),
    montoIva: num(pick(f, "mntIVA", "detMntIVA", "montoIva")),
    montoTotal: num(pick(f, "mntTotal", "detMntTotal", "montoTotal")),
    montoIvaNoRecuperable: num(pick(f, "mntIVANoRec", "detMntIVANoRec", "montoIvaNoRecuperable")),
    codigoIvaNoRec: pick(f, "codIVANoRec", "detCodIVANoRec", "detMntCodNoRec")
      ? Number(pick(f, "codIVANoRec", "detCodIVANoRec", "detMntCodNoRec"))
      : undefined,
    montoActivoFijo: num(pick(f, "mntActivoFijo", "detMntActivoFijo", "detMntActFijo")),
    estadoRcv: estado,
    trackId: pick<string>(f, "trackId", "detTrackId"),
    crudo: f,
  };
}

/** El portal no entregó XML para el rango: sin documentos, o más de los que permite una descarga. */
export class RangoSinXmlError extends Error {
  constructor(
    readonly desde: string,
    readonly hasta: string,
  ) {
    super(`El portal no entregó XML para ${desde}..${hasta} (rango vacío o con demasiados documentos).`);
    this.name = "RangoSinXmlError";
  }
}

export const esRangoSinXml = (e: unknown): e is RangoSinXmlError =>
  e instanceof Error && e.name === "RangoSinXmlError";

const UA_NAVEGADOR =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

/** Mezcla las `Set-Cookie` de una respuesta sobre un header `Cookie` (las nuevas pisan a las viejas). */
function fusionarCookies(cookies: string, setCookies: string[]): string {
  if (setCookies.length === 0) return cookies;
  const mapa = new Map<string, string>();
  for (const par of cookies.split(";")) {
    const [k, ...resto] = par.trim().split("=");
    if (k) mapa.set(k, resto.join("="));
  }
  for (const c of setCookies) {
    const [par] = c.split(";");
    const [k, ...resto] = par!.split("=");
    if (!k) continue;
    const valor = resto.join("=");
    if (valor === "" || /expires=Thu, 01[- ]Jan[- ]1970/i.test(c)) mapa.delete(k.trim());
    else mapa.set(k.trim(), valor);
  }
  return [...mapa.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/**
 * Se autentica una sola vez (según lo implemente la subclase) y usa las cookies
 * resultantes tanto para `probar()` como para bajar el RCV de compras/ventas.
 */
export abstract class SiiSesionCookieClient implements SiiClient {
  private cookies: string | null = null;
  private cookiesTs = 0;

  constructor(protected readonly rut: string) {}

  /** Debe devolver el header `Cookie` de una sesión válida, o lanzar. */
  protected abstract obtenerCookies(): Promise<string>;

  /** Descripción del método de autenticación, para el mensaje de `probar()`. */
  protected abstract etiquetaMetodo(): string;

  private async autenticar(): Promise<void> {
    if (this.cookies && Date.now() - this.cookiesTs < SESION_TTL_MS) return;
    const cookiesLogin = await this.obtenerCookies();
    this.cookies = await this.calentarSesion(cookiesLogin);
    this.cookiesTs = Date.now();
  }

  /**
   * Tras el login, un navegador real navega a la home de "Mi SII" antes de tocar
   * cualquier otro portal — esa carga puede fijar cookies adicionales (ej. `RUT_NS`,
   * `DV_NS`, `NETSCAPE_LIVEWIRE.*`) que el login por sí solo no entrega. El RCV
   * (`consdcvinternetui`) solo necesita `TOKEN` y por eso funcionaba igual sin este
   * paso, pero el Sistema de Facturación Gratuita (`www1.sii.cl`, ver
   * `descargarXmlCompras`/`descargarXmlVentas`) devolvía HTML de error en vez del XML
   * — confirmado en vivo que faltaba algo del lado de las cookies. Replicamos ese
   * salto extra y fusionamos las cookies nuevas con las del login.
   *
   * VALIDAR: si tras esto `www1.sii.cl` sigue sin reconocer la sesión, el problema no
   * es falta de cookies sino otra cosa (ej. certificado TLS en vez de cookie) y hay
   * que revisar de nuevo.
   */
  private async calentarSesion(cookies: string): Promise<string> {
    const res = await fetch("https://misiir.sii.cl/cgi_misii/siihome.cgi", {
      headers: { Cookie: cookies, "User-Agent": UA_NAVEGADOR },
      redirect: "manual",
    });
    return fusionarCookies(cookies, res.headers.getSetCookie?.() ?? []);
  }

  /**
   * Cierra la sesión en el SII (`autTermino.cgi`, el mismo que usa "Cerrar Sesión" de la
   * barra). El SII limita las sesiones abiertas por RUT ("ha superado el máximo de sesiones
   * autenticadas") y no las libera hasta que vencen: un proceso que se autentica seguido,
   * como la descarga horaria, tiene que cerrar la suya al terminar.
   */
  async cerrarSesion(): Promise<void> {
    const cookies = this.cookies;
    this.cookies = null;
    if (!cookies) return;
    await fetch("https://zeusr.sii.cl/cgi_AUT2000/autTermino.cgi", {
      headers: { Cookie: cookies, "User-Agent": UA_NAVEGADOR },
      redirect: "manual",
    })
      .then((r) => r.arrayBuffer())
      .catch(() => undefined);
  }

  async probar(): Promise<ResultadoPrueba> {
    try {
      await this.autenticar();
      return { ok: true, detalle: `Login con ${this.etiquetaMetodo()} correcto.` };
    } catch (e) {
      return { ok: false, detalle: e instanceof Error ? e.message : "Error desconocido" };
    }
  }

  /**
   * Registra ACD/RCD/ERM/RFP/RFT sobre un DTE recibido — `rutDte` es el RUT del
   * *emisor* del documento (el proveedor), no el de esta empresa.
   */
  async aceptarOReclamarDocumento(
    rutDte: string,
    tipoDoc: number,
    folio: string,
    accion: AccionDte,
  ): Promise<RespuestaSii> {
    await this.autenticar();
    const { cuerpo, dv } = partesRut(rutDte);
    return ingresarAceptacionReclamoDoc(this.cookies!, {
      rutEmisor: cuerpo,
      dvEmisor: dv,
      tipoDoc,
      folio,
      accionDoc: accion,
    });
  }

  /** Historial de eventos (aceptaciones/reclamos) de un DTE recibido. */
  async listarEventosDocumento(
    rutDte: string,
    tipoDoc: number,
    folio: string,
  ): Promise<{ respuesta: RespuestaSii; eventos: EventoDte[] }> {
    await this.autenticar();
    const { cuerpo, dv } = partesRut(rutDte);
    return listarEventosHistDoc(this.cookies!, { rutEmisor: cuerpo, dvEmisor: dv, tipoDoc, folio });
  }

  async rcvCompras(periodo: Periodo): Promise<DocRcv[]> {
    return this.bajarRcv("compra", periodo);
  }
  async rcvVentas(periodo: Periodo): Promise<DocRcv[]> {
    return this.bajarRcv("venta", periodo);
  }

  /** POST genérico al facade del RCV; centraliza headers, `metaData` y manejo de errores. */
  private async llamarFacade(path: string, data: Record<string, unknown>, conversationId: string): Promise<Record<string, unknown>> {
    const cuerpoReq = {
      metaData: {
        namespace: `${RCV_NAMESPACE}/${path}`,
        conversationId,
        transactionId: randomUUID(),
        page: null,
      },
      data,
    };
    const res = await fetch(`${RCV_BASE}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: RCV_REFERER,
        Origin: "https://www4.sii.cl",
        Cookie: this.cookies!,
        "User-Agent": "Mozilla/5.0 (ERP-SIG)",
      },
      body: JSON.stringify(cuerpoReq),
    });
    if (res.status === 401 || res.status === 403) {
      this.cookies = null;
      const snippet = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
      throw new Error(
        `La sesión del SII expiró o no tiene permiso sobre este RUT ` +
          `(status ${res.status}).${snippet ? ` Respuesta: ${snippet}` : ""}`,
      );
    }
    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
      throw new Error(`El SII respondió ${res.status} al pedir ${path}.${snippet ? ` Respuesta: ${snippet}` : ""}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  private async bajarRcv(origen: "compra" | "venta", periodo: Periodo): Promise<DocRcv[]> {
    await this.autenticar();
    const { cuerpo, dv } = partesRut(this.rut);
    const pathDetalle = origen === "compra" ? "getDetalleCompra" : "getDetalleVenta";
    const accionRecaptcha = origen === "compra" ? "RCV_DETC" : "RCV_DETV"; // VALIDAR: acción para venta
    const conversationId = extraerToken(this.cookies!);
    const out: DocRcv[] = [];

    // Ventas: un solo estado. Compras: se itera por estado contable.
    const estados = origen === "compra" ? ESTADOS : (["REGISTRO"] as SiiEstadoRcv[]);
    for (const estado of estados) {
      const datosBase = {
        rutEmisor: cuerpo,
        dvEmisor: dv,
        ptributario: periodo,
        operacion: origen.toUpperCase(),
        estadoContab: estado,
      };

      // El detalle no trae "todos los tipos de documento" en una sola llamada: primero
      // hay que pedir el resumen (qué tipos de documento hay en este período/estado) y
      // recién ahí pedir el detalle tipo por tipo.
      const resumen = await this.llamarFacade("getResumen", { ...datosBase, busquedaInicial: true }, conversationId);
      const filasResumen = Array.isArray(resumen.data) ? (resumen.data as Record<string, unknown>[]) : [];
      const tiposDoc = [...new Set(filasResumen.map((r) => Number(r.rsmnTipoDocInteger)).filter((n) => Number.isFinite(n)))];

      for (const tipoDoc of tiposDoc) {
        const detalle = await this.llamarFacade(
          pathDetalle,
          { ...datosBase, codTipoDoc: String(tipoDoc), accionRecaptcha, tokenRecaptcha: "t-o-k-e-n-web" },
          conversationId,
        );
        const filas = detalle.data;
        if (!Array.isArray(filas)) continue;
        for (const f of filas) {
          const doc = parseFilaRcv(f as Record<string, unknown>, estado, tipoDoc);
          if (doc) out.push(doc);
        }
      }
    }
    return out;
  }

  /**
   * GET dentro del portal legacy `www1.sii.cl`: manda las cookies acumuladas y absorbe
   * las `Set-Cookie` de la respuesta (el portal las va fijando a lo largo del recorrido).
   */
  private async getPortal(url: string, referer: string): Promise<Response> {
    const res = await fetch(url, {
      headers: {
        Cookie: this.cookies!,
        "User-Agent": UA_NAVEGADOR,
        Referer: referer,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-419,es;q=0.9",
      },
      redirect: "manual",
    });
    this.cookies = fusionarCookies(this.cookies!, res.headers.getSetCookie?.() ?? []);
    return res;
  }

  /**
   * Descarga el XML `SetDTE` del Sistema de Facturación Gratuita (`www1.sii.cl`,
   * Portal001) para un rango de fechas — a diferencia del RCV, trae el detalle línea
   * por línea de cada documento (ver `dte-xml.ts`). Solo aplica a empresas cuyo
   * `tipoFacturador = "SII Gratuito"`; un facturador comercial no publica sus DTE ahí.
   *
   * Pedir `mipeDownLoad.cgi` directo devolvía "Error al contribuyente": el portal solo
   * acepta la descarga tras haber pasado por el launcher y el listado de documentos
   * (así lo hace el navegador, según la captura de red), por eso se replica ese
   * recorrido — launcher → listado inicial → listado filtrado → descarga — con
   * `Referer` encadenado y las cookies que el portal va fijando en cada paso.
   */
  private async descargarXmlDte(
    origen: "RCP" | "ENV",
    fechaDesde: string,
    fechaHasta: string,
  ): Promise<Buffer> {
    await this.autenticar();

    const cgi = "https://www1.sii.cl/cgi-bin/Portal001";
    const campoContraparte = origen === "RCP" ? "RUT_EMI" : "RUT_RECP";
    const cgiListado = origen === "RCP" ? "mipeAdminDocsRcp.cgi" : "mipeAdminDocsEmi.cgi";
    const opcion = origen === "RCP" ? 1 : 2;
    const pasos: string[] = [];

    // El launcher no entrega el listado directo: si la sesión no tiene empresa elegida,
    // redirige (con JS) a `mipeSelEmpresa.cgi`, que elige la empresa del usuario autorizado
    // (fija las cookies `NETSCAPE_LIVEWIRE.rcmp/dcmp`) y devuelve al launcher. El navegador
    // sigue esos saltos solo; acá hay que seguirlos a mano. Sin esa empresa, el listado
    // responde "Error al contribuyente" aunque la sesión sea válida.
    const launcher = `${cgi}/mipeLaunchPage.cgi?OPCION=${opcion}&TIPO=4`;
    let urlActual = launcher;
    let refererActual = "https://www.sii.cl/servicios_online/1039-1183.html";
    for (let salto = 0; salto < 4; salto++) {
      const r = await this.getPortal(urlActual, refererActual);
      const cuerpo = Buffer.from(await r.arrayBuffer()).toString("latin1");
      pasos.push(`${new URL(urlActual).pathname.split("/").pop()}=${r.status}`);
      const destino = r.headers.get("location") ?? /location\.replace\("([^"]+)"\)/.exec(cuerpo)?.[1];
      if (!destino) break;
      if (/RepresentacionNoAut/i.test(destino)) {
        throw new Error(
          `El SII no permite al titular operar como ${this.rut} en Facturación electrónica ` +
            `(sin aplicación autorizada). Autorízala en el SII o conecta con la clave de la propia empresa.`,
        );
      }
      refererActual = urlActual;
      urlActual = new URL(destino, urlActual).toString();
    }
    const empresaPortal = /NETSCAPE_LIVEWIRE\.rcmp=([^;]+)/.exec(this.cookies!)?.[1];
    if (empresaPortal && empresaPortal !== partesRut(this.rut).cuerpo) {
      throw new Error(
        `El portal de Facturación Gratuita seleccionó la empresa ${empresaPortal}, no ${this.rut}. ` +
          `Este usuario está autorizado allí para otra empresa; revisa el titular configurado.`,
      );
    }

    const filtrosVacios = `${campoContraparte}=&FOLIO=&RZN_SOC=&FEC_DESDE=&FEC_HASTA=&TPO_DOC=&ESTADO=&ORDEN=&NUM_PAG=1`;
    const listadoInicial = `${cgi}/${cgiListado}?${filtrosVacios}`;
    const rIni = await this.getPortal(listadoInicial, launcher);
    pasos.push(`listado=${rIni.status}`);
    await rIni.arrayBuffer();

    const listadoFiltrado =
      `${cgi}/${cgiListado}?ORDEN=&NUM_PAG=1&recaptcha-response=&${campoContraparte}=&FOLIO=&RZN_SOC=` +
      `&FEC_DESDE=${fechaDesde}&FEC_HASTA=${fechaHasta}&TPO_DOC=&ESTADO=`;
    const rFil = await this.getPortal(listadoFiltrado, listadoInicial);
    pasos.push(`filtrado=${rFil.status}`);
    const htmlFiltrado = Buffer.from(await rFil.arrayBuffer()).toString("latin1");
    const tituloListado = /<title>([\s\S]*?)<\/title>/i.exec(htmlFiltrado)?.[1]?.replace(/\s+/g, " ").trim();
    pasos.push(`título listado="${tituloListado ?? "?"}"`);

    const params = new URLSearchParams({
      ORIGEN: origen,
      [campoContraparte]: "",
      FOLIO: "",
      RZN_SOC: "",
      FEC_DESDE: fechaDesde,
      FEC_HASTA: fechaHasta,
      TPO_DOC: "",
      ESTADO: "",
      ORDEN: "",
      DOWNLOAD: "XML",
    });
    const res = await this.getPortal(`${cgi}/mipeDownLoad.cgi?${params.toString()}`, listadoFiltrado);
    pasos.push(`descarga=${res.status}`);
    if (res.status !== 200) {
      throw new Error(
        `El SII respondió ${res.status} al descargar el XML de ${origen === "RCP" ? "compras" : "ventas"}. ` +
          `Recorrido: ${pasos.join(", ")}.`,
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // El portal legacy a veces responde 200 con una página de error HTML en vez del XML
    // (ej. sesión no reconocida) — se detecta por el content-type, no por el status.
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      const texto = buf
        .toString("latin1")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600);
      // Confirmado en vivo: con la empresa ya verificada (rcmp == RUT), el portal responde
      // "Error al contribuyente" tanto si el rango no tiene documentos como si tiene más
      // de ~20 (el tope de la descarga). No hay cómo distinguirlos acá: quien llama decide
      // (ej. partir el rango en tramos más chicos).
      if (empresaPortal === partesRut(this.rut).cuerpo && /^Error al contribuyente\b/i.test(texto)) {
        throw new RangoSinXmlError(fechaDesde, fechaHasta);
      }
      const nombresCookies = this.cookies!
        .split(";")
        .map((c) => c.trim().split("=")[0])
        .join(",");
      throw new Error(
        `El Sistema de Facturación Gratuita no devolvió un XML (content-type: ${contentType}). ` +
          `Texto de la respuesta: ${texto || "(vacío)"}. ` +
          `Recorrido: ${pasos.join(", ")}. Cookies enviadas: ${nombresCookies}.`,
      );
    }
    return buf;
  }

  /** DTE de documentos recibidos (compras) en el rango `fechaDesde`..`fechaHasta` (`YYYY-MM-DD`). */
  async descargarXmlCompras(fechaDesde: string, fechaHasta: string): Promise<Buffer> {
    return this.descargarXmlDte("RCP", fechaDesde, fechaHasta);
  }

  /** DTE de documentos emitidos (ventas) en el rango `fechaDesde`..`fechaHasta` (`YYYY-MM-DD`). */
  async descargarXmlVentas(fechaDesde: string, fechaHasta: string): Promise<Buffer> {
    return this.descargarXmlDte("ENV", fechaDesde, fechaHasta);
  }
}
