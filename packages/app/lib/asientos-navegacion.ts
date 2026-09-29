import { validarFiltrosAsientos } from "@erp/shared";
import type { ReferenciaAsiento } from "@erp/db";
import { rutaOrigen } from "./origen-asiento";

export function rutaReferenciaAsiento(empresaId: string, referencia: ReferenciaAsiento) {
  return rutaOrigen(empresaId, { origenTabla: referencia.tabla, origenId: referencia.id, pagoTipo: referencia.pagoTipo ?? null, anio: referencia.anio });
}

/** Nunca adivinar el tipo de una referencia ambigua ni salir de la empresa. */
export function referenciaDeLinea(referencias: ReferenciaAsiento[], id: string | null) {
  const candidatas = referencias.filter((r) => r.id === id);
  return candidatas.length === 1 ? candidatas[0]! : null;
}

/** El retorno contiene únicamente filtros válidos, nunca una URL proporcionada por el cliente. */
export function rutaListaAsientos(empresaId: string, lista: unknown, hoy: string) {
  const base = `/panel/${empresaId}/contabilidad/asientos`;
  if (typeof lista !== "string" || !lista || lista.length > 1000) return base;
  const query = new URLSearchParams(lista);
  const params = Object.fromEntries([...query.keys()].map((key) => [key, query.getAll(key).length === 1 ? query.get(key) : query.getAll(key)]));
  const validado = validarFiltrosAsientos(params, hoy);
  if (!validado.success) return base;
  const limpio = new URLSearchParams();
  for (const [key, value] of Object.entries(validado.data)) if (value) limpio.set(key, value);
  return `${base}?${limpio}`;
}
