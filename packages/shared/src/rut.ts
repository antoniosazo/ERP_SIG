/** Utilidades de RUT chileno: normalización y validación de dígito verificador (módulo 11). */

export function normalizarRut(rutSucio: string): string {
  return rutSucio.replace(/[.\s]/g, "").toUpperCase();
}

export function calcularDigitoVerificador(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

export function esRutValido(rutSucio: string): boolean {
  const rut = normalizarRut(rutSucio);
  const match = /^(\d{1,8})-([0-9K])$/.exec(rut);
  if (!match) return false;
  const [, cuerpo, dv] = match;
  return calcularDigitoVerificador(cuerpo!) === dv;
}

export function formatearRut(rutSucio: string): string {
  const rut = normalizarRut(rutSucio);
  const match = /^(\d{1,8})-([0-9K])$/.exec(rut);
  if (!match) return rut;
  const [, cuerpo, dv] = match;
  const cuerpoFormateado = cuerpo!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoFormateado}-${dv}`;
}
