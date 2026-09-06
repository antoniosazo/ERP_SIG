/** Formato de números por empresa (config de "Visualización", estilo SAP B1). */
export type FormatoNumero = {
  separadorDecimal: string; // "," | "."
  separadorMiles: string; //  "." | "," | " " | ""
};

/**
 * Formatea un número con los separadores dados. `decimales` fija la cantidad de
 * decimales (con `toFixed`). Agrupa la parte entera de a 3 con `separadorMiles`
 * (si es `""` no agrupa). Respeta el signo.
 */
export function formatearNumero(
  valor: number | string,
  decimales: number,
  { separadorDecimal, separadorMiles }: FormatoNumero,
): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "";

  const negativo = n < 0;
  const partes = Math.abs(n).toFixed(Math.max(0, decimales)).split(".");
  const entero = partes[0] ?? "0";
  const dec = partes[1] ?? "";
  const enteroAgrupado = separadorMiles
    ? entero.replace(/\B(?=(\d{3})+(?!\d))/g, separadorMiles)
    : entero;
  const cuerpo = decimales > 0 ? `${enteroAgrupado}${separadorDecimal}${dec}` : enteroAgrupado;
  return negativo ? `-${cuerpo}` : cuerpo;
}

/**
 * Formatea un monto usando los decimales **propios de su moneda** (`monedas.decimales`).
 * Esta es la única vía correcta para mostrar importes: cada moneda define su precisión
 * (CLP 0, USD 2, UF 4). Para números sin moneda (tipo de cambio, porcentajes) usar
 * `formatearNumero` con el decimal correspondiente de la config de Visualización.
 */
export function formatearMonto(
  valor: number | string,
  moneda: { decimales: number },
  fmt: FormatoNumero,
): string {
  return formatearNumero(valor, moneda.decimales, fmt);
}

/**
 * Convierte un texto escrito por el usuario a número, según los separadores dados:
 * quita el separador de miles y cambia el decimal por `.`. `""` → `null`.
 * Devuelve `null` si el resultado no es un número finito.
 */
export function parsearNumero(
  texto: string,
  { separadorDecimal, separadorMiles }: FormatoNumero,
): number | null {
  const limpio = texto.trim();
  if (limpio === "") return null;

  let s = limpio;
  if (separadorMiles) s = s.split(separadorMiles).join("");
  if (separadorDecimal !== ".") s = s.split(separadorDecimal).join(".");
  // Tolerancia: si aún quedan comas (usuario escribió "," con config "."), tratarlas como decimal.
  s = s.replace(/,/g, ".");

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
