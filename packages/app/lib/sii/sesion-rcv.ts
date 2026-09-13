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
    this.cookies = await this.obtenerCookies();
    this.cookiesTs = Date.now();
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
}
