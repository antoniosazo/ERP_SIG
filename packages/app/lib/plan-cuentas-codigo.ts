/**
 * Cálculo del código automático para cuentas nuevas. El código nunca se escribe a
 * mano: una cuenta hija toma `<padre>.<n+1>` y una cuenta raíz el siguiente entero.
 */

type CuentaCodigo = { id?: string; cuentaPadreId: string | null; codigoCuenta: string };

/** Primer segmento numérico de un código (`"5.2.10"` → 5). `NaN` si no aplica. */
function primerSegmento(codigo: string): number {
  return Number.parseInt(codigo.split(".")[0] ?? "", 10);
}

/** Siguiente código para una cuenta hija directa de `padre`: `<padre>.<max+1>`. */
export function siguienteCodigoHijo(
  padre: { id: string; codigoCuenta: string },
  cuentas: CuentaCodigo[],
): string {
  const prefijo = `${padre.codigoCuenta}.`;
  const usados = cuentas
    .filter((c) => c.cuentaPadreId === padre.id && c.codigoCuenta.startsWith(prefijo))
    .map((c) => Number.parseInt(c.codigoCuenta.slice(prefijo.length).split(".")[0] ?? "", 10))
    .filter((n) => Number.isFinite(n));
  return `${prefijo}${(usados.length ? Math.max(...usados) : 0) + 1}`;
}

/** Siguiente código para una cuenta raíz (nivel 1): el mayor entero raíz + 1. */
export function siguienteCodigoRaiz(cuentas: CuentaCodigo[]): string {
  const usados = cuentas
    .filter((c) => c.cuentaPadreId === null)
    .map((c) => primerSegmento(c.codigoCuenta))
    .filter((n) => Number.isFinite(n));
  return String((usados.length ? Math.max(...usados) : 0) + 1);
}

/** Profundidad de una cuenta según su cadena de ancestros: la cuenta raíz es nivel 1. */
export function profundidadDeCuenta(
  cuentas: { id: string; cuentaPadreId: string | null }[],
  cuentaId: string,
): number {
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const visto = new Set<string>();
  let actual = porId.get(cuentaId);
  let nivel = 1;
  while (actual?.cuentaPadreId && !visto.has(actual.id)) {
    visto.add(actual.id);
    actual = porId.get(actual.cuentaPadreId);
    nivel++;
  }
  return nivel;
}
