import * as XLSX from "xlsx";
import type { CartolaCodificacion, CartolaTipoArchivo } from "@erp/shared";

/**
 * Extrae filas crudas (arrays de strings) de un archivo de cartola, según su tipo. Para
 * Excel usa `xlsx`; CSV/delimitado y TXT de ancho fijo se parsean a mano porque el
 * formato de número/fecha chileno y la codificación Latin-1 no los resuelve ninguna
 * librería genérica de todos modos. Para TXT de ancho fijo cada fila es un array de un
 * solo elemento (la línea cruda) — `mapearFila` recorta por posición, no por columna.
 */
export function extraerFilasCrudas(
  tipoArchivo: CartolaTipoArchivo,
  codificacion: CartolaCodificacion,
  separador: string | null,
  filasOmitirInicio: number,
  filasOmitirFin: number,
  bytes: Uint8Array,
): string[][] {
  let filas: string[][];

  if (tipoArchivo === "Excel") {
    const libro = XLSX.read(bytes, { type: "array" });
    const hoja = libro.Sheets[libro.SheetNames[0]!];
    if (!hoja) throw new Error("El archivo Excel no tiene hojas");
    const filasCrudas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: false, defval: "" });
    filas = filasCrudas.map((fila) => fila.map((celda) => String(celda ?? "").trim()));
  } else {
    const decoder = new TextDecoder(codificacion === "Latin-1" ? "iso-8859-1" : "utf-8");
    const texto = decoder.decode(bytes);
    const lineas = texto.split(/\r\n|\r|\n/).filter((l) => l.length > 0);
    filas =
      tipoArchivo === "TxtAnchoFijo"
        ? lineas.map((linea) => [linea])
        : lineas.map((linea) => linea.split(separador || ";").map((c) => c.trim()));
  }

  const fin = filasOmitirFin > 0 ? filas.length - filasOmitirFin : filas.length;
  return filas.slice(filasOmitirInicio, fin);
}
