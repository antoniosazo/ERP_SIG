import type { CampoDef } from "@/lib/documento-venta-campos";

/** Un solo vocabulario de estados para listas, formularios y avisos. */
const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "Borrador",
  abierto: "Abierto",
  contabilizado: "Contabilizado",
  cerrado: "Cerrado",
  anulado: "Anulado",
};
export const etiquetaEstado = (estado: string) => ETIQUETA_ESTADO[estado] ?? estado;

/** Qué sigue para un documento de compra, en una línea (null si no hay nada que hacer). */
export function pasoSiguienteCompra(docTipo: string, estado: string, esNuevo: boolean): string | null {
  if (esNuevo || estado === "borrador") {
    if (docTipo === "pedido") return "Completa los datos y pulsa «Guardar y abrir» para dejar la orden vigente. «Guardar borrador» te permite seguir después.";
    if (docTipo === "factura") return "Completa los datos y pulsa «Guardar y contabilizar»: la factura queda contabilizada al guardar.";
    return "Completa los datos. «Guardar y contabilizar» genera el asiento; «Guardar borrador» te permite seguir después.";
  }
  if (docTipo === "pedido" && estado === "abierto") return "Orden vigente. Cuando llegue la mercadería o la factura, usa «Continuar con…».";
  if (docTipo === "entrada_mercaderia" && estado === "contabilizado") return "Entrada contabilizada. Cuando llegue la factura, usa «Traer a factura».";
  if (docTipo === "factura" && estado === "contabilizado") return "Factura contabilizada. Registra el pago desde «Registrar pago».";
  return null;
}

/** Qué sigue para un documento de venta. */
export function pasoSiguienteVenta(estado: string, esNuevo: boolean): string | null {
  if (esNuevo || estado === "borrador") {
    return "Completa los datos. «Guardar y contabilizar» genera el asiento; «Guardar borrador» te permite seguir después.";
  }
  if (estado === "contabilizado") return "Documento contabilizado. Puedes registrar su cobro desde Tesorería.";
  return null;
}

/** Aplana los errores de react-hook-form a frases cortas con el nombre del campo y la línea. */
export function resumenErrores(errors: unknown, cabecera: CampoDef[], linea: CampoDef[], maximo = 8): string[] {
  const etiqueta = (defs: CampoDef[], id: string) => defs.find((c) => c.id === id)?.label ?? id;
  const salida: string[] = [];
  const recorrer = (nodo: unknown, ruta: (string | number)[]) => {
    if (!nodo || typeof nodo !== "object") return;
    const mensaje = (nodo as { message?: unknown }).message;
    if (typeof mensaje === "string" && mensaje) {
      const [primero, indice, campo] = ruta;
      const texto =
        primero === "lineas" && typeof indice === "number"
          ? `Línea ${indice + 1}${campo ? ` · ${etiqueta(linea, String(campo))}` : ""}: ${mensaje}`
          : primero === "lineas"
            ? mensaje
            : `${etiqueta(cabecera, String(primero ?? ""))}: ${mensaje}`;
      if (!salida.includes(texto)) salida.push(texto);
      return;
    }
    for (const [clave, valor] of Object.entries(nodo)) {
      if (clave === "ref" || clave === "type" || clave === "types") continue;
      recorrer(valor, [...ruta, /^\d+$/.test(clave) ? Number(clave) : clave]);
    }
  };
  recorrer(errors, []);
  return salida.slice(0, maximo);
}
