/**
 * Web Service oficial del SII de Aceptación/Reclamo a DTE recibido (Ley 19.983) —
 * a diferencia del RCV, este SÍ tiene WSDL público y está documentado por el SII
 * ("Web Service de Consulta y Registro de Aceptación/Reclamo a DTE recibido" v1.1).
 * Endpoint y namespace confirmados contra el WSDL real de producción.
 *
 * Reusa la sesión (cookie `TOKEN`) ya autenticada para el RCV — las cookies de sesión
 * del SII se setean con dominio `.sii.cl`, por lo que sirven también para este
 * subdominio (`ws1.sii.cl`) sin loguearse de nuevo.
 *
 * ⚠️ El contrato (namespace, endpoint, campos) está confirmado contra el WSDL público,
 * pero el comportamiento en vivo (SOAPAction exacto que espera, formato real de la
 * respuesta) no se ha probado todavía contra el SII real. Puntos a verificar marcados
 * con `// VALIDAR:`.
 */
const ENDPOINT = "https://ws1.sii.cl/WSREGISTRORECLAMODTE/registroreclamodteservice";
const NAMESPACE = "http://ws.registroreclamodte.diii.sdi.sii.cl";

/** Acciones válidas sobre un DTE recibido (ver `accionDoc` del WS). */
export type AccionDte = "ACD" | "RCD" | "ERM" | "RFP" | "RFT";

export type EventoDte = {
  codEvento: string;
  descEvento: string;
  rutResponsable: string;
  dvResponsable: string;
  fechaEvento: string;
};

export type RespuestaSii = { codigo: number; descripcion: string };

function extraerTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`));
  return m?.[1];
}

function extraerBloques(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "g");
  return [...xml.matchAll(re)].map((m) => m[1]!);
}

// VALIDAR: SOAPAction vacío es lo habitual en servicios Axis/JBoss como este, pero no
// se confirmó contra el endpoint real.
async function llamarSoap(
  cookies: string,
  operacion: string,
  params: Record<string, string>,
): Promise<string> {
  const campos = Object.entries(params)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join("");
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="${NAMESPACE}">` +
    `<soapenv:Header/><soapenv:Body><ws:${operacion}>${campos}</ws:${operacion}></soapenv:Body>` +
    `</soapenv:Envelope>`;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
      Cookie: cookies,
      "User-Agent": "Mozilla/5.0 (ERP-SIG)",
    },
    body,
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(
      `El SII respondió ${res.status} en ${operacion}.` +
        ` Respuesta: ${texto.replace(/\s+/g, " ").slice(0, 300)}`,
    );
  }
  return texto;
}

function respuestaDe(xml: string): RespuestaSii {
  return {
    codigo: Number(extraerTag(xml, "codResp") ?? "-1"),
    descripcion: extraerTag(xml, "descResp") ?? "El SII no devolvió una respuesta reconocible.",
  };
}

/** Registra ACD/RCD/ERM/RFP/RFT sobre un DTE recibido. */
export async function ingresarAceptacionReclamoDoc(
  cookies: string,
  params: { rutEmisor: string; dvEmisor: string; tipoDoc: number; folio: string; accionDoc: AccionDte },
): Promise<RespuestaSii> {
  const xml = await llamarSoap(cookies, "ingresarAceptacionReclamoDoc", {
    rutEmisor: params.rutEmisor,
    dvEmisor: params.dvEmisor,
    tipoDoc: String(params.tipoDoc),
    folio: params.folio,
    accionDoc: params.accionDoc,
  });
  return respuestaDe(xml);
}

/** Historial de eventos (aceptaciones/reclamos) registrados sobre un DTE. */
export async function listarEventosHistDoc(
  cookies: string,
  params: { rutEmisor: string; dvEmisor: string; tipoDoc: number; folio: string },
): Promise<{ respuesta: RespuestaSii; eventos: EventoDte[] }> {
  const xml = await llamarSoap(cookies, "listarEventosHistDoc", {
    rutEmisor: params.rutEmisor,
    dvEmisor: params.dvEmisor,
    tipoDoc: String(params.tipoDoc),
    folio: params.folio,
  });
  const eventos = extraerBloques(xml, "listaEventosDoc").map((bloque) => ({
    codEvento: extraerTag(bloque, "codEvento") ?? "",
    descEvento: extraerTag(bloque, "descEvento") ?? "",
    rutResponsable: extraerTag(bloque, "rutResponsable") ?? "",
    dvResponsable: extraerTag(bloque, "dvResponsable") ?? "",
    fechaEvento: extraerTag(bloque, "fechaEvento") ?? "",
  }));
  return { respuesta: respuestaDe(xml), eventos };
}
