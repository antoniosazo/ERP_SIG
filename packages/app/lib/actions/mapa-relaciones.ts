"use server";

import { obtenerMapaRelaciones, TABLAS_MAPA, type TablaMapa } from "@erp/db";
import { requireRolEnEmpresa } from "@/lib/auth-helpers";
import { mapaADTO } from "@/lib/mapa-dto";
import type { MapaRelacionesDTO } from "@/lib/mapa-grafo";

const ROLES = ["Administrador", "Contador"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MapaRelacionesResultado = { ok: true; mapa: MapaRelacionesDTO } | { ok: false; error: string };

/** Mapa de relaciones de un documento: de dónde viene y qué se generó a partir de él. */
export async function mapaRelacionesAction(empresaId: string, tabla: string, id: string): Promise<MapaRelacionesResultado> {
  await requireRolEnEmpresa(empresaId, ROLES);
  if (!(TABLAS_MAPA as readonly string[]).includes(tabla) || !UUID.test(id)) {
    return { ok: false, error: "Registro inválido" };
  }
  try {
    const mapa = await obtenerMapaRelaciones(empresaId, tabla as TablaMapa, id);
    if (!mapa) return { ok: false, error: "El registro no existe en esta empresa" };
    return { ok: true, mapa: mapaADTO(empresaId, mapa) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo obtener el mapa" };
  }
}
