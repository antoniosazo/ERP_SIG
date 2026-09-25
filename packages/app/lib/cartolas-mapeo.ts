import type {
  CartolaCampoDestino,
  CartolaFormatoFecha,
  CartolaFormatoNumero,
  CartolaReglaSigno,
  CartolaTipoArchivo,
  FilaCartolaMapeada,
} from "@erp/shared";

export type FormatoCampoMapeo = {
  campoDestino: CartolaCampoDestino;
  columnaIndice: number | null;
  posicionInicio: number | null;
  posicionLargo: number | null;
};

function extraerValor(tipoArchivo: CartolaTipoArchivo, fila: string[], campo: FormatoCampoMapeo | undefined): string {
  if (!campo) return "";
  if (tipoArchivo === "TxtAnchoFijo") {
    if (campo.posicionInicio == null || campo.posicionLargo == null) return "";
    const linea = fila[0] ?? "";
    return linea.slice(campo.posicionInicio, campo.posicionInicio + campo.posicionLargo).trim();
  }
  if (campo.columnaIndice == null) return "";
  return (fila[campo.columnaIndice] ?? "").trim();
}

function parsearFecha(valor: string, formato: CartolaFormatoFecha): string {
  if (formato === "aaaa-mm-dd") return valor;
  if (formato === "aaaammdd") {
    const v = valor.replace(/\D/g, "");
    if (v.length !== 8) throw new Error(`Fecha inválida: "${valor}"`);
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  }
  const partes = valor.split(/[/-]/);
  if (partes.length !== 3) throw new Error(`Fecha inválida: "${valor}"`);
  const [dd, mm, aaaa] = partes;
  return `${aaaa}-${(mm ?? "").padStart(2, "0")}-${(dd ?? "").padStart(2, "0")}`;
}

function parsearNumero(valorCrudo: string, formato: CartolaFormatoNumero): number {
  const v = valorCrudo.trim();
  if (v === "") return 0;
  let normalizado = v;
  if (formato === "MilesPuntoDecimalComa") normalizado = v.replace(/\./g, "").replace(",", ".");
  else if (formato === "MilesComaDecimalPunto") normalizado = v.replace(/,/g, "");
  const n = Number(normalizado);
  if (Number.isNaN(n)) throw new Error(`Monto inválido: "${valorCrudo}"`);
  return n;
}

/** Mapea una fila cruda a `FilaCartolaMapeada` según la plantilla. Devuelve `null` para
 * filas en blanco (sin fecha, descripción ni monto) — comunes al final de un Excel. */
export function mapearFila(
  tipoArchivo: CartolaTipoArchivo,
  campos: FormatoCampoMapeo[],
  formatoFecha: CartolaFormatoFecha,
  formatoNumero: CartolaFormatoNumero,
  reglaSigno: CartolaReglaSigno,
  fila: string[],
): FilaCartolaMapeada | null {
  const porCampo = new Map(campos.map((c) => [c.campoDestino, c]));
  const valorFecha = extraerValor(tipoArchivo, fila, porCampo.get("Fecha"));
  const descripcion = extraerValor(tipoArchivo, fila, porCampo.get("Descripcion"));

  let monto: number;
  if (reglaSigno === "ColumnaConSigno") {
    monto = parsearNumero(extraerValor(tipoArchivo, fila, porCampo.get("MontoConSigno")), formatoNumero);
  } else {
    const cargo = Math.abs(parsearNumero(extraerValor(tipoArchivo, fila, porCampo.get("Cargo")), formatoNumero));
    const abono = Math.abs(parsearNumero(extraerValor(tipoArchivo, fila, porCampo.get("Abono")), formatoNumero));
    monto = abono - cargo;
  }

  if (!valorFecha && !descripcion && monto === 0) return null;

  return {
    fecha: parsearFecha(valorFecha, formatoFecha),
    descripcion: descripcion || "(sin descripción)",
    nroDocumento: extraerValor(tipoArchivo, fila, porCampo.get("NroDocumento")) || null,
    rutContraparte: extraerValor(tipoArchivo, fila, porCampo.get("RutContraparte")) || null,
    monto,
    // El código de transacción del banco (y su catálogo de traducción a tipo interno) se
    // mapea recién en Conciliación (Fase 2 de Bancos) — no aporta nada sin esa fase.
    codigoTransaccion: null,
  };
}
