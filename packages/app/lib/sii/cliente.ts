/**
 * Interfaz del cliente SII y su fábrica. Módulo **solo servidor**.
 * El adaptador concreto (`clave.ts`) hace requests HTTP a `sii.cl`; el mock (`mock.ts`)
 * devuelve datos fijos para desarrollo y tests.
 */
import { createHash } from "node:crypto";
import type { CredencialesSii, DocRcv, Periodo, ResultadoPrueba } from "./tipos";
import type { AccionDte, EventoDte, RespuestaSii } from "./reclamo-dte";
import { SiiClaveClient } from "./clave";
import { SiiCertificadoClient } from "./certificado";
import { SiiClientMock } from "./mock";

export interface SiiClient {
  /** Documentos recibidos (Registro de Compras) del período. */
  rcvCompras(periodo: Periodo): Promise<DocRcv[]>;
  /** Documentos emitidos (Registro de Ventas) del período. */
  rcvVentas(periodo: Periodo): Promise<DocRcv[]>;
  /** Verifica autenticación contra el SII sin descargar nada. */
  probar(): Promise<ResultadoPrueba>;
  /** Registra ACD/RCD/ERM/RFP/RFT sobre un DTE recibido (`rutDte` = RUT del emisor). */
  aceptarOReclamarDocumento(
    rutDte: string,
    tipoDoc: number,
    folio: string,
    accion: AccionDte,
  ): Promise<RespuestaSii>;
  /** Historial de eventos (aceptaciones/reclamos) de un DTE recibido. */
  listarEventosDocumento(
    rutDte: string,
    tipoDoc: number,
    folio: string,
  ): Promise<{ respuesta: RespuestaSii; eventos: EventoDte[] }>;
  /** Cierra la sesión abierta en el SII (si hay una). Seguro de llamar siempre. */
  cerrarSesion(): Promise<void>;
  /** XML `SetDTE` de documentos recibidos (compras) del Sistema de Facturación Gratuita. */
  descargarXmlCompras(fechaDesde: string, fechaHasta: string): Promise<Buffer>;
  /** XML `SetDTE` de documentos emitidos (ventas) del Sistema de Facturación Gratuita. */
  descargarXmlVentas(fechaDesde: string, fechaHasta: string): Promise<Buffer>;
}

/**
 * Reusa la instancia (y por lo tanto la sesión ya autenticada, ver `SESION_TTL_MS` en
 * `sesion-rcv.ts`) entre requests del servidor. Sin este cache cada clic del usuario
 * ("Probar conexión", "Ver datos crudos", "Importar") abría una sesión nueva en el SII
 * sin cerrar la anterior — el SII bloquea el login al superar su máximo de sesiones
 * concurrentes ("Usted ha superado el máximo de sesiones autenticadas...").
 * La key incluye las credenciales mismas: si cambian (nueva clave/certificado guardado
 * en Configuración), la key cambia sola y se crea una instancia nueva.
 */
const cacheClientes = new Map<string, SiiClient>();

function claveCache(cred: CredencialesSii): string {
  if (cred.metodo === "certificado") {
    const huellaCert = createHash("sha256").update(cred.certificadoBase64).digest("hex");
    return `certificado:${cred.rut}:${cred.rutTitular}:${cred.certPass ?? ""}:${huellaCert}`;
  }
  return `clave:${cred.rut}:${cred.rutTitular}:${cred.clave}`;
}

/**
 * `SII_USAR_MOCK=1` fuerza el mock (para desarrollo sin credenciales / tests manuales).
 */
export function crearSiiClient(cred: CredencialesSii): SiiClient {
  if (process.env.SII_USAR_MOCK === "1") return new SiiClientMock();
  const key = claveCache(cred);
  const existente = cacheClientes.get(key);
  if (existente) return existente;
  const cliente =
    cred.metodo === "certificado"
      ? new SiiCertificadoClient(cred.rut, cred.rutTitular, cred.certificadoBase64, cred.certPass ?? "")
      : new SiiClaveClient(cred.rut, cred.clave, cred.rutTitular);
  cacheClientes.set(key, cliente);
  return cliente;
}
