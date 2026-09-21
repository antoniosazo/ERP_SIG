/**
 * Parser del XML `SetDTE` que entrega el Sistema de Facturación Gratuita del SII
 * (`www1.sii.cl/cgi-bin/Portal001/mipeDownLoad.cgi`, ver `historial-dte.ts`) — a
 * diferencia del RCV (solo totales), este trae el detalle línea por línea de cada
 * documento. Es el formato oficial y estable del DTE chileno, no un endpoint privado:
 * a diferencia del resto de `lib/sii/`, este parser no debería romperse con cambios de
 * SII salvo que cambien el estándar de facturación electrónica en sí.
 *
 * Los archivos vienen declarados como `ISO-8859-1` — hay que decodificar los bytes con
 * ese charset antes de parsear, o los acentos (á, é, ñ, etc.) quedan corruptos.
 */
import { XMLParser } from "fast-xml-parser";

export type DteLineaParseada = {
  nroLinea: number;
  nombre: string;
  descripcion?: string;
  cantidad?: number;
  precioUnitario?: number;
  montoItem: number;
  exento: boolean;
};

export type DteReferenciaParseada = {
  tipoDocRef: string;
  folioRef: string;
  fechaRef?: string;
  razonRef?: string;
};

export type DteParseado = {
  tipoDte: number;
  folio: string;
  fechaEmision: string;
  rutEmisor: string;
  razonSocialEmisor: string;
  rutReceptor: string;
  razonSocialReceptor: string;
  montoNeto: number;
  montoExento: number;
  montoIva: number;
  montoTotal: number;
  lineas: DteLineaParseada[];
  referencias: DteReferenciaParseada[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

/** El XML normaliza un RUT como cuerpo separado del dígito verificador en otros lados
 * de este proyecto (`normalizarRut`/`formatearRut`), pero acá viene ya junto (ej.
 * "76148405-2"), igual que lo espera `terceros.rut` — no hace falta recomponerlo. */
function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Decodifica un buffer `ISO-8859-1` y extrae todos los `<Documento>` del `<SetDTE>`.
 * Un `SetDTE` puede traer documentos "acompañantes" (ej. una guía de traslado T52
 * referenciada por la factura) — se devuelven todos, sin filtrar, y es responsabilidad
 * de quien llama decidir cuáles importar (normalmente solo facturas/notas, no guías).
 */
export function parsearSetDte(xmlBuffer: Buffer): DteParseado[] {
  const xml = xmlBuffer.toString("latin1");
  const doc = parser.parse(xml) as Record<string, unknown>;

  const setDte = doc.SetDTE as Record<string, unknown> | undefined;
  if (!setDte) return [];

  const dtes = asArray(setDte.DTE as Record<string, unknown> | Record<string, unknown>[]);
  const out: DteParseado[] = [];

  for (const dte of dtes) {
    const documento = dte.Documento as Record<string, unknown> | undefined;
    if (!documento) continue;

    const encabezado = documento.Encabezado as Record<string, unknown> | undefined;
    if (!encabezado) continue;

    const idDoc = encabezado.IdDoc as Record<string, unknown> | undefined;
    const emisor = encabezado.Emisor as Record<string, unknown> | undefined;
    const receptor = encabezado.Receptor as Record<string, unknown> | undefined;
    const totales = encabezado.Totales as Record<string, unknown> | undefined;
    if (!idDoc || !emisor || !receptor || !totales) continue;

    const lineas = asArray(
      documento.Detalle as Record<string, unknown> | Record<string, unknown>[] | undefined,
    ).map(
      (d, i): DteLineaParseada => ({
        nroLinea: Number(d.NroLinDet) || i + 1,
        nombre: str(d.NmbItem) || "Detalle",
        descripcion: d.DscItem ? str(d.DscItem) : undefined,
        cantidad: d.QtyItem != null ? num(d.QtyItem) : undefined,
        precioUnitario: d.PrcItem != null ? num(d.PrcItem) : undefined,
        montoItem: num(d.MontoItem),
        // IndExe=1..8 indica exento; también hay líneas informativas ("Fecha-Guía") con
        // MontoItem=0 en las facturas de combustible — quedan igual, se filtran aguas
        // abajo si no aportan monto.
        exento: d.IndExe != null,
      }),
    );

    const referencias = asArray(
      documento.Referencia as Record<string, unknown> | Record<string, unknown>[] | undefined,
    ).map(
      (r): DteReferenciaParseada => ({
        tipoDocRef: str(r.TpoDocRef),
        folioRef: str(r.FolioRef),
        fechaRef: r.FchRef ? str(r.FchRef) : undefined,
        razonRef: r.RazonRef ? str(r.RazonRef) : undefined,
      }),
    );

    out.push({
      tipoDte: num(idDoc.TipoDTE),
      folio: str(idDoc.Folio),
      fechaEmision: str(idDoc.FchEmis),
      rutEmisor: str(emisor.RUTEmisor),
      razonSocialEmisor: str(emisor.RznSoc),
      rutReceptor: str(receptor.RUTRecep),
      razonSocialReceptor: str(receptor.RznSocRecep),
      montoNeto: num(totales.MntNeto),
      montoExento: num(totales.MntExe),
      montoIva: num(totales.IVA),
      montoTotal: num(totales.MntTotal),
      lineas,
      referencias,
    });
  }

  return out;
}
