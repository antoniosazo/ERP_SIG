"use server";

import { cambiarEstadoDtesBandeja, cargarDtesDeBandeja } from "@erp/db";
import { revalidatePath } from "next/cache";
import { auditCtx, requireRolEnEmpresa } from "@/lib/auth-helpers";
import { descargarXmlABandeja } from "@/lib/sii/descarga-xml";

const ROLES = ["Administrador", "Contador"];

const rutasBandeja = (empresaId: string) => [
  `/panel/${empresaId}/compras/bandeja-sii`,
  `/panel/${empresaId}/ventas/bandeja-sii`,
];

function revalidarDocumentos(empresaId: string) {
  for (const p of rutasBandeja(empresaId)) revalidatePath(p);
  for (const slug of ["facturas", "notas-credito", "notas-debito"]) {
    revalidatePath(`/panel/${empresaId}/compras/${slug}`);
    revalidatePath(`/panel/${empresaId}/ventas/${slug}`);
  }
}

/** "Descargar ahora": misma descarga que la tarea horaria, a pedido del usuario. */
export async function descargarXmlAhoraAction(
  empresaId: string,
  dias: number,
): Promise<{ ok: true; detalle: string } | { ok: false; error: string }> {
  await requireRolEnEmpresa(empresaId, ROLES);
  const r = await descargarXmlABandeja(empresaId, dias);
  revalidarDocumentos(empresaId);
  return r.ok ? { ok: true, detalle: r.detalle } : { ok: false, error: r.error };
}

export type ResultadoCargaBandeja =
  | {
      ok: true;
      cargados: number;
      errores: number;
      detalle: { id: string; folio: string; resultado: string }[];
    }
  | { ok: false; error: string };

/** Convierte los DTE seleccionados de la bandeja en documentos; las facturas quedan contabilizadas. */
export async function cargarBandejaAction(
  empresaId: string,
  ids: string[],
): Promise<ResultadoCargaBandeja> {
  const session = await requireRolEnEmpresa(empresaId, ROLES);
  try {
    const r = await cargarDtesDeBandeja(empresaId, ids, auditCtx(session));
    revalidarDocumentos(empresaId);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export async function cambiarEstadoBandejaAction(
  empresaId: string,
  ids: string[],
  estado: "pendiente" | "descartado",
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRolEnEmpresa(empresaId, ROLES);
  try {
    await cambiarEstadoDtesBandeja(empresaId, ids, estado);
    for (const p of rutasBandeja(empresaId)) revalidatePath(p);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}
