/**
 * Descarga los XML de compras y ventas del Sistema de Facturación Gratuita de una empresa
 * y los deja en la bandeja previa a la carga (`sii_dtes_pendientes`). Módulo solo servidor.
 * Lo usan la tarea horaria (`/api/cron/sii-xml`) y el botón "Descargar ahora".
 */
import { guardarDtesEnBandeja, registrarDescargaXml, type ResumenBandeja } from "@erp/db";
import { credencialesEnClaro } from "./credenciales";
import { crearSiiClient, type SiiClient } from "./cliente";
import { parsearSetDte, type DteParseado } from "./dte-xml";
import { esRangoSinXml } from "./sesion-rcv";

/** El portal rechaza rangos de más de ~20 días: se pide de a tramos de este largo. */
const TRAMO_DIAS = 15;

const fmt = (d: Date) => d.toISOString().slice(0, 10);

const sumarDias = (iso: string, n: number) => fmt(new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86_400_000));

/**
 * Baja un rango; si el portal no entrega XML (vacío, o más documentos que el tope de una
 * descarga) lo parte a la mitad y reintenta. Un solo día que tampoco entrega queda en
 * `sinXml`: puede estar vacío o tener más documentos que el tope, y el portal no lo distingue.
 */
export async function bajarRango(
  bajar: (desde: string, hasta: string) => Promise<Buffer>,
  desde: string,
  hasta: string,
  sinXml: string[],
): Promise<DteParseado[]> {
  try {
    return parsearSetDte(await bajar(desde, hasta));
  } catch (e) {
    if (!esRangoSinXml(e)) throw e;
    if (desde >= hasta) {
      sinXml.push(desde);
      return [];
    }
    const dias = Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86_400_000);
    const mitad = sumarDias(desde, Math.floor(dias / 2));
    return [
      ...(await bajarRango(bajar, desde, mitad, sinXml)),
      ...(await bajarRango(bajar, sumarDias(mitad, 1), hasta, sinXml)),
    ];
  }
}

export type ResultadoDescargaXml =
  | { ok: true; compra: ResumenBandeja; venta: ResumenBandeja; detalle: string }
  | { ok: false; error: string };

const vacio = (): ResumenBandeja => ({ nuevos: 0, yaCargados: 0, existentes: 0, omitidos: 0, tercerosCreados: 0 });

function sumar(a: ResumenBandeja, b: ResumenBandeja): ResumenBandeja {
  return {
    nuevos: a.nuevos + b.nuevos,
    yaCargados: a.yaCargados + b.yaCargados,
    existentes: a.existentes + b.existentes,
    omitidos: a.omitidos + b.omitidos,
    tercerosCreados: a.tercerosCreados + b.tercerosCreados,
  };
}

export async function descargarXmlABandeja(empresaId: string, dias = 7): Promise<ResultadoDescargaXml> {
  let cliente: SiiClient | undefined;
  try {
    const cred = await credencialesEnClaro(empresaId);
    const client = (cliente = crearSiiClient(cred));
    const hoy = fmt(new Date());
    const desde = sumarDias(hoy, -(Math.min(Math.max(dias, 1), 90) - 1));
    const sinXml: string[] = [];
    // Tramos de ~15 días para no partir siempre desde un rango enorme.
    let compra = vacio();
    let venta = vacio();
    for (let ini = desde; ini <= hoy; ini = sumarDias(ini, TRAMO_DIAS)) {
      const fin = sumarDias(ini, TRAMO_DIAS - 1) < hoy ? sumarDias(ini, TRAMO_DIAS - 1) : hoy;
      compra = sumar(
        compra,
        await guardarDtesEnBandeja(empresaId, "compra", await bajarRango((d, h) => client.descargarXmlCompras(d, h), ini, fin, sinXml)),
      );
      venta = sumar(
        venta,
        await guardarDtesEnBandeja(empresaId, "venta", await bajarRango((d, h) => client.descargarXmlVentas(d, h), ini, fin, sinXml)),
      );
    }
    const detalle =
      `Últimos ${dias} días — compras: ${compra.nuevos} nuevas, ${compra.existentes} ya en bandeja, ${compra.yaCargados} ya cargadas, ${compra.tercerosCreados} proveedor(es) creado(s); ` +
      `ventas: ${venta.nuevos} nuevas, ${venta.existentes} ya en bandeja, ${venta.yaCargados} ya cargadas, ${venta.tercerosCreados} cliente(s) creado(s).` +
      (sinXml.length ? ` (${sinXml.length} consulta(s) diaria(s) sin XML: sin documentos o más del tope de descarga.)` : "");
    await registrarDescargaXml(empresaId, detalle);
    return { ok: true, compra, venta, detalle };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Error desconocido";
    await registrarDescargaXml(empresaId, `Error: ${error}`).catch(() => undefined);
    return { ok: false, error };
  } finally {
    await cliente?.cerrarSesion();
  }
}
