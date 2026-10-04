import { timingSafeEqual } from "node:crypto";
import { conFirma, listarEmpresasConXmlSii, listarFirmasContables } from "@erp/db";
import { descargarXmlABandeja } from "@/lib/sii/descarga-xml";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Ventana de la corrida horaria: cubre DTE que el SII publica con días de atraso. */
const DIAS_VENTANA = 10;

/** Compara el secreto en tiempo constante — evita que la latencia delate el valor byte a byte. */
function autorizado(header: string | null, secreto: string): boolean {
  const esperado = Buffer.from(`Bearer ${secreto}`);
  const recibido = Buffer.from(header ?? "");
  if (recibido.length !== esperado.length) return false;
  return timingSafeEqual(recibido, esperado);
}

/**
 * Tarea horaria: baja los XML de compras y ventas de cada empresa con SII Gratuito y los
 * deja en la bandeja de validación. No hay sesión de usuario: se protege con `CRON_SECRET`
 * (header `Authorization: Bearer <secreto>`), que el programador externo debe enviar.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return Response.json({ error: "CRON_SECRET no está configurado." }, { status: 500 });
  if (!autorizado(request.headers.get("authorization"), secreto)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const resultados: { firmaId: string; empresaId: string; rut: string; ok: boolean; detalle: string }[] = [];
  const firmas = (await listarFirmasContables()).filter((f) => f.estado === "Activa" && f.estadoBase === "lista");
  // Una firma y una empresa a la vez: el SII limita las sesiones concurrentes por RUT y los
  // portales legacy no toleran ráfagas. Cada firma corre en su propia base.
  for (const firma of firmas) {
    await conFirma(firma.id, async () => {
      for (const e of await listarEmpresasConXmlSii()) {
        const tieneCredencial = e.metodoAuth === "certificado" ? e.tieneCertificado : e.tieneClave;
        if (!tieneCredencial) continue;
        const r = await descargarXmlABandeja(e.empresaId, DIAS_VENTANA);
        resultados.push({ firmaId: firma.id, empresaId: e.empresaId, rut: e.rut, ok: r.ok, detalle: r.ok ? r.detalle : r.error });
      }
    });
  }
  return Response.json({ firmas: firmas.length, empresas: resultados.length, resultados });
}
