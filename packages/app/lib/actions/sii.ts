"use server";

import {
  guardarCredencialesSii,
  importarDocumentosRcv,
  obtenerCredencialesSii,
  obtenerDatosSiiDocumentoCompra,
} from "@erp/db";
import type { SiiAmbiente, SiiMetodoAuth } from "@erp/shared";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";
import { cifrar, descifrar, descifrarOpcional } from "@/lib/sii/cripto";
import { crearSiiClient } from "@/lib/sii/cliente";
import type { AccionDte, EventoDte } from "@/lib/sii/reclamo-dte";
import type { CredencialesSii, DocRcv } from "@/lib/sii/tipos";

const ROLES = ["Administrador", "Contador"];

export type EstadoCredencialesSii = {
  configurado: boolean;
  rut: string | null;
  metodoAuth: SiiMetodoAuth;
  rutTitularCertificado: string | null;
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
    metodoAuth: (row?.metodoAuth as SiiMetodoAuth) ?? "clave",
    rutTitularCertificado: row?.rutTitularCertificado ?? null,
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
    metodoAuth: SiiMetodoAuth;
    rutTitularCertificado?: string;
    clave?: string;
    certificadoBase64?: string;
    certPass?: string;
    ambiente: SiiAmbiente;
    certificadoVence?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRolEnEmpresa(empresaId, ROLES);
  if (!input.rut?.trim()) return { ok: false, error: "Indica el RUT." };
  try {
    await guardarCredencialesSii(empresaId, {
      rut: input.rut.trim(),
      metodoAuth: input.metodoAuth,
      rutTitularCertificado: input.rutTitularCertificado?.trim() || null,
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

async function credencialesEnClaro(empresaId: string): Promise<CredencialesSii> {
  const row = await obtenerCredencialesSii(empresaId);
  if (!row) throw new Error("Configura primero la conexión con el SII.");
  const ambiente = row.ambiente as SiiAmbiente;
  if (row.metodoAuth === "certificado") {
    if (!row.certificadoCifrado) {
      throw new Error("Configura primero el certificado digital (.pfx / .p12) en Conexión SII.");
    }
    return {
      metodo: "certificado",
      rut: row.rut,
      rutTitular: row.rutTitularCertificado || row.rut,
      ambiente,
      certificadoBase64: descifrar(row.certificadoCifrado),
      certPass: descifrarOpcional(row.certificadoPassCifrada),
    };
  }
  if (!row.claveCifrada) {
    throw new Error("Configura primero el RUT y la Clave Tributaria en Conexión SII.");
  }
  return { metodo: "clave", rut: row.rut, ambiente, clave: descifrar(row.claveCifrada) };
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

export type ResultadoRcvCrudo = { ok: true; docs: DocRcv[] } | { ok: false; error: string };

/**
 * `periodo` = `YYYY-MM`. Descarga el RCV tal cual lo entrega el SII, sin crear ni
 * validar nada en el sistema — solo para inspeccionar qué trae y confirmar conexión.
 */
export async function descargarRcvCrudoAction(
  empresaId: string,
  periodo: string,
  origen: "compra" | "venta",
): Promise<ResultadoRcvCrudo> {
  await requireRolEnEmpresa(empresaId, ROLES);
  const ym = periodo.replace("-", "");
  if (!/^\d{6}$/.test(ym)) return { ok: false, error: "Período inválido." };
  try {
    const cred = await credencialesEnClaro(empresaId);
    const client = crearSiiClient(cred);
    const docs = origen === "compra" ? await client.rcvCompras(ym) : await client.rcvVentas(ym);
    return { ok: true, docs };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export type ResultadoImportacionSii =
  | {
      ok: true;
      creados: number;
      existentes: number;
      errores: number;
      detalle: unknown[];
    }
  | { ok: false; error: string };

const SLUGS_REVALIDAR: Record<"compra" | "venta", string[]> = {
  compra: ["pedidos", "facturas", "notas-credito", "notas-debito"],
  venta: ["facturas", "notas-credito", "notas-debito"],
};

/** `periodo` = `YYYY-MM` (del <input type="month">). Importa solo compras o solo ventas. */
export async function importarRcvAction(
  empresaId: string,
  periodo: string,
  origen: "compra" | "venta",
): Promise<ResultadoImportacionSii> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  const ym = periodo.replace("-", "");
  if (!/^\d{6}$/.test(ym)) return { ok: false, error: "Período inválido." };
  try {
    const cred = await credencialesEnClaro(empresaId);
    const client = crearSiiClient(cred);
    const ctx = auditCtx(session);
    const docs = origen === "compra" ? await client.rcvCompras(ym) : await client.rcvVentas(ym);
    const resultado = await importarDocumentosRcv(empresaId, origen, ym, docs, ctx);
    for (const slug of SLUGS_REVALIDAR[origen]) {
      revalidatePath(`/panel/${empresaId}/${origen === "compra" ? "compras" : "ventas"}/${slug}`);
    }
    return { ok: true, ...resultado };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
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
