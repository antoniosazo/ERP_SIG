"use server";

import {
  guardarCredencialesSii,
  obtenerCredencialesSii,
  obtenerDatosSiiDocumentoCompra,
} from "@erp/db";
import type { SiiAmbiente, SiiMetodoAuth, TipoFacturador } from "@erp/shared";
import { revalidatePath } from "next/cache";
import { requireRolEnEmpresa } from "@/lib/auth-helpers";
import { cifrar } from "@/lib/sii/cripto";
import { credencialesEnClaro } from "@/lib/sii/credenciales";
import { crearSiiClient } from "@/lib/sii/cliente";
import { parsearSetDte } from "@/lib/sii/dte-xml";
import { esRangoSinXml } from "@/lib/sii/sesion-rcv";
import type { AccionDte, EventoDte } from "@/lib/sii/reclamo-dte";

const ROLES = ["Administrador", "Contador"];

export type EstadoCredencialesSii = {
  configurado: boolean;
  rut: string | null;
  tipoFacturador: TipoFacturador;
  nombreFacturador: string | null;
  metodoAuth: SiiMetodoAuth;
  rutTitular: string | null;
  tieneClave: boolean;
  tieneCertificado: boolean;
  ambiente: SiiAmbiente;
  certificadoVence: string | null;
  ultimaSyncPeriodo: string | null;
};

export async function obtenerEstadoSiiAction(empresaId: string): Promise<EstadoCredencialesSii> {
  await requireRolEnEmpresa(empresaId, ROLES);
  const row = await obtenerCredencialesSii(empresaId);
  return {
    configurado: !!row,
    rut: row?.rut ?? null,
    tipoFacturador: (row?.tipoFacturador as TipoFacturador) ?? "SII Gratuito",
    nombreFacturador: row?.nombreFacturador ?? null,
    metodoAuth: (row?.metodoAuth as SiiMetodoAuth) ?? "clave",
    rutTitular: row?.rutTitular ?? null,
    tieneClave: !!row?.claveCifrada,
    tieneCertificado: !!row?.certificadoCifrado,
    ambiente: (row?.ambiente as SiiAmbiente) ?? "produccion",
    certificadoVence: row?.certificadoVence ?? null,
    ultimaSyncPeriodo: row?.ultimaSyncPeriodo ?? null,
  };
}

export async function guardarCredencialesSiiAction(
  empresaId: string,
  input: {
    rut: string;
    tipoFacturador: TipoFacturador;
    nombreFacturador?: string;
    metodoAuth: SiiMetodoAuth;
    rutTitular?: string;
    clave?: string;
    certificadoBase64?: string;
    certPass?: string;
    ambiente: SiiAmbiente;
    certificadoVence?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRolEnEmpresa(empresaId, ROLES);
  if (!input.rut?.trim()) return { ok: false, error: "Indica el RUT." };
  if (input.tipoFacturador === "Facturador comercial" && !input.nombreFacturador?.trim()) {
    return { ok: false, error: "Indica el nombre del facturador comercial." };
  }
  try {
    await guardarCredencialesSii(empresaId, {
      rut: input.rut.trim(),
      tipoFacturador: input.tipoFacturador,
      nombreFacturador: input.nombreFacturador?.trim() || null,
      metodoAuth: input.metodoAuth,
      rutTitular: input.rutTitular?.trim() || null,
      claveCifrada: input.clave ? cifrar(input.clave) : undefined,
      certificadoCifrado: input.certificadoBase64 ? cifrar(input.certificadoBase64) : undefined,
      certificadoPassCifrada: input.certPass ? cifrar(input.certPass) : undefined,
      ambiente: input.ambiente,
      certificadoVence: input.certificadoVence || null,
    });
    revalidatePath(`/panel/${empresaId}/configuracion/sii`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export async function probarConexionSiiAction(
  empresaId: string,
): Promise<{ ok: boolean; detalle: string }> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const cred = await credencialesEnClaro(empresaId);
    return await crearSiiClient(cred).probar();
  } catch (e) {
    return { ok: false, detalle: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export type ResultadoPruebaXmlDte =
  | {
      ok: true;
      detalle: string;
      documentos: { tipoDte: number; folio: string; fechaEmision: string; rutContraparte: string }[];
    }
  | { ok: false; detalle: string };

/**
 * Prueba puntual de `descargarXmlCompras`/`descargarXmlVentas` (Sistema de
 * Facturación Gratuita, `www1.sii.cl`) — descarga los últimos 3 días y solo informa
 * cuántos documentos trajo, sin crear ni tocar nada en el sistema. Sirve para validar
 * que la sesión se comparte con ese portal (ver el `// VALIDAR` en `sesion-rcv.ts`)
 * antes de construir la importación real. Ventana chica a propósito: el portal
 * rechaza rangos de más de ~20 días (confirmado en vivo), y mezclar ese límite con la
 * prueba de sesión solo complica el diagnóstico — la importación real (todavía sin
 * construir) sí va a tener que trocear por rango, no esta prueba.
 */
export async function probarDescargaXmlDteAction(
  empresaId: string,
  origen: "compra" | "venta",
): Promise<ResultadoPruebaXmlDte> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const cred = await credencialesEnClaro(empresaId);
    const client = crearSiiClient(cred);
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    let xml: Buffer;
    try {
      xml =
        origen === "compra"
          ? await client.descargarXmlCompras(fmt(desde), fmt(hasta))
          : await client.descargarXmlVentas(fmt(desde), fmt(hasta));
    } catch (e) {
      if (!esRangoSinXml(e)) throw e;
      xml = Buffer.from("<SetDTE></SetDTE>", "latin1");
    }
    const documentos = parsearSetDte(xml).map((d) => ({
      tipoDte: d.tipoDte,
      folio: d.folio,
      fechaEmision: d.fechaEmision,
      rutContraparte: origen === "compra" ? d.rutEmisor : d.rutReceptor,
    }));
    return {
      ok: true,
      detalle: `Se encontraron ${documentos.length} documento(s) de ${origen === "compra" ? "compra" : "venta"} en los últimos 30 días.`,
      documentos,
    };
  } catch (e) {
    return { ok: false, detalle: e instanceof Error ? e.message : "Error desconocido" };
  }
}

const ETIQUETA_ACCION: Record<AccionDte, string> = {
  ACD: "Aceptación del contenido",
  RCD: "Reclamo al contenido",
  ERM: "Recibo de mercaderías/servicios",
  RFP: "Reclamo por falta parcial de mercadería",
  RFT: "Reclamo por falta total de mercadería",
};

/**
 * Registra ante el SII (Ley 19.983) una aceptación o reclamo sobre la factura de
 * compra recibida — usa el Web Service oficial de Aceptación/Reclamo de DTE, con la
 * misma sesión ya autenticada para el RCV. Es una notificación al SII: no cambia el
 * estado del documento en este sistema (eso se hace aparte, ej. anulándolo).
 */
export async function registrarAceptacionReclamoAction(
  empresaId: string,
  documentoCompraId: string,
  accion: AccionDte,
): Promise<{ ok: true; detalle: string } | { ok: false; error: string }> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const datos = await obtenerDatosSiiDocumentoCompra(documentoCompraId, empresaId);
    if (!datos) {
      return { ok: false, error: "El documento no existe o no tiene folio/tipo de documento del SII." };
    }
    const cred = await credencialesEnClaro(empresaId);
    const client = crearSiiClient(cred);
    const r = await client.aceptarOReclamarDocumento(
      datos.rutProveedor,
      Number(datos.codigoSiiDoc),
      datos.folio,
      accion,
    );
    if (!r.descripcion.toLowerCase().includes("completada ok")) {
      return { ok: false, error: `SII: ${r.descripcion} (código ${r.codigo})` };
    }
    return { ok: true, detalle: `${ETIQUETA_ACCION[accion]} registrada en el SII.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export type ResultadoEventosSii =
  | { ok: true; eventos: EventoDte[]; mensaje: string }
  | { ok: false; error: string };

/** Historial de aceptación/reclamo que el SII tiene registrado para esta factura de compra. */
export async function verEventosDocumentoCompraAction(
  empresaId: string,
  documentoCompraId: string,
): Promise<ResultadoEventosSii> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const datos = await obtenerDatosSiiDocumentoCompra(documentoCompraId, empresaId);
    if (!datos) {
      return { ok: false, error: "El documento no existe o no tiene folio/tipo de documento del SII." };
    }
    const cred = await credencialesEnClaro(empresaId);
    const client = crearSiiClient(cred);
    const { respuesta, eventos } = await client.listarEventosDocumento(
      datos.rutProveedor,
      Number(datos.codigoSiiDoc),
      datos.folio,
    );
    return { ok: true, eventos, mensaje: respuesta.descripcion };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}
