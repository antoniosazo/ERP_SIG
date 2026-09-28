import { MAX_PROFUNDIDAD_CUENTA, type ClaseCuenta, type CrearCuentaInput } from "@erp/shared";

type Cuenta = {
  id: string;
  cuentaPadreId: string | null;
  codigoCuenta: string;
  nombreCuenta: string;
  clase: ClaseCuenta;
  modoMoneda: string;
  monedaFijaId: string | null;
  requiereAnalisisTerceros: boolean;
};

/** Calcula y valida todos los cambios antes de escribir el árbol. */
export function planificarCuenta(
  cuentas: Cuenta[],
  input: CrearCuentaInput,
  cuentaId?: string,
  conMovimientos: ReadonlySet<string> = new Set(),
) {
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const antes = cuentaId ? porId.get(cuentaId) : undefined;
  if (cuentaId && !antes) throw new Error("La cuenta no existe en esta empresa");
  if (antes?.cuentaPadreId === null && (
    input.codigoCuenta !== antes.codigoCuenta || input.nombreCuenta !== antes.nombreCuenta || input.cuentaPadreId
  )) throw new Error("Las cuentas principales no permiten cambiar el código, el nombre ni la cuenta padre.");

  let clase = input.clase;
  let nivel = 1;
  const visitados = new Set(cuentaId ? [cuentaId] : []);
  let padreId = input.cuentaPadreId;
  while (padreId) {
    if (visitados.has(padreId)) throw new Error("La cuenta padre no puede ser la misma cuenta ni una descendiente");
    visitados.add(padreId);
    const padre = porId.get(padreId);
    if (!padre) throw new Error("La cuenta padre no existe en esta empresa");
    clase = padre.clase;
    nivel++;
    padreId = padre.cuentaPadreId;
  }
  const padre = input.cuentaPadreId ? porId.get(input.cuentaPadreId) : undefined;
  validarCodigo(input.codigoCuenta, padre?.codigoCuenta);

  const hijos = new Map<string, Cuenta[]>();
  for (const c of cuentas) {
    if (c.cuentaPadreId) hijos.set(c.cuentaPadreId, [...(hijos.get(c.cuentaPadreId) ?? []), c]);
  }
  const cambios: { id: string; codigoCuenta: string; clase: ClaseCuenta }[] = [];
  const recorridos = new Set<string>();
  function visitar(c: Cuenta, codigo: string, profundidad: number) {
    if (recorridos.has(c.id)) throw new Error("Ciclo en la jerarquía de cuentas");
    recorridos.add(c.id);
    validarNivel(profundidad);
    if (c.clase !== clase && conMovimientos.has(c.id)) {
      throw new Error(`La cuenta ${c.codigoCuenta} tiene movimientos: no se puede cambiar la clase de este grupo.`);
    }
    cambios.push({ id: c.id, codigoCuenta: codigo, clase });
    for (const hija of hijos.get(c.id) ?? []) {
      let codigoHija = hija.codigoCuenta;
      if (codigo !== c.codigoCuenta) {
        validarCodigo(hija.codigoCuenta, c.codigoCuenta);
        codigoHija = codigo + hija.codigoCuenta.slice(c.codigoCuenta.length);
      }
      if (codigoHija.length > 30) throw new Error("La renumeración supera los 30 caracteres en una cuenta hija");
      visitar(hija, codigoHija, profundidad + 1);
    }
  }
  validarNivel(nivel);
  if (antes) visitar(antes, input.codigoCuenta, nivel);
  const modificados = new Set(cambios.map((c) => c.id));
  const codigos = new Set(cuentas.filter((c) => !modificados.has(c.id)).map((c) => c.codigoCuenta));
  for (const codigo of antes ? cambios.map((c) => c.codigoCuenta) : [input.codigoCuenta]) {
    if (codigos.has(codigo)) throw new Error(`Ya existe una cuenta con el código ${codigo} en esta empresa.`);
    codigos.add(codigo);
  }

  const monedaFijaId = input.modoMoneda === "Extranjera fija" ? input.monedaFijaId ?? null : null;
  if (input.modoMoneda === "Extranjera fija" && !monedaFijaId) throw new Error("Indica la moneda fija de la cuenta");
  if (antes && conMovimientos.has(antes.id) && (
    antes.modoMoneda !== input.modoMoneda || antes.monedaFijaId !== monedaFijaId ||
    antes.requiereAnalisisTerceros !== input.requiereAnalisisTerceros
  )) throw new Error("La cuenta ya tiene movimientos: no se puede cambiar la moneda ni el control de terceros.");
  return { clase, monedaFijaId, cambios };
}

function validarNivel(nivel: number) {
  if (nivel > MAX_PROFUNDIDAD_CUENTA) throw new Error(`El plan de cuentas admite como máximo ${MAX_PROFUNDIDAD_CUENTA} niveles.`);
}

function validarCodigo(codigo: string, padre?: string) {
  const segmento = padre ? codigo.slice(padre.length + 1) : codigo;
  if (!codigo.trim() || codigo.length > 30 || !segmento || segmento.includes(".") ||
    (padre && !codigo.startsWith(`${padre}.`))) {
    throw new Error(padre ? `El código debe ser ${padre} seguido de un punto y un segmento, por ejemplo ${padre}.1.` : "El código de una cuenta raíz debe tener un solo segmento.");
  }
}

export function validarMonedaCuenta(
  monedaFijaId: string | null,
  empresaId: string,
  moneda: { id: string; empresaId: string | null } | undefined,
) {
  if (monedaFijaId && (!moneda || moneda.id !== monedaFijaId || moneda.empresaId !== empresaId)) {
    throw new Error("La moneda fija no pertenece a esta empresa");
  }
}
