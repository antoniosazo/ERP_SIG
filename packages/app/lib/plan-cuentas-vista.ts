import { CLASE_CUENTA, NATURALEZA_CUENTA, naturalezaSugerida } from "@erp/shared";
import type { ClaseCuenta, crearCuentaSchema } from "@erp/shared";
import type { z } from "zod";
import type { CuentaLite } from "@/components/panel/cuenta-form-dialog";
import { siguienteCodigoHijo, siguienteCodigoRaiz } from "./plan-cuentas-codigo";
type FormValues = z.input<typeof crearCuentaSchema>;

export function descendientesCuenta(cuentas: CuentaLite[], id?: string) {
  const ids = new Set<string>();
  const pendientes = id ? [id] : [];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    if (ids.has(actual)) continue;
    ids.add(actual);
    for (const c of cuentas) if (c.cuentaPadreId === actual) pendientes.push(c.id);
  }
  return ids;
}

export function filtrarPlanCuentas(cuentas: CuentaLite[], texto: string, estado: string, tipo: string) {
  const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const busqueda = normalizar(texto.trim());
  const coincidencias = new Set(cuentas.filter((c) =>
    (!busqueda || normalizar(`${c.codigoCuenta} ${c.nombreCuenta}`).includes(busqueda)) &&
    (estado === "todas" || c.activa === (estado === "activas")) &&
    (tipo === "todas" || c.nivelImputable === (tipo === "imputables"))
  ).map((c) => c.id));
  const visibles = new Set(coincidencias);
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  for (const id of coincidencias) {
    let padre = porId.get(id)?.cuentaPadreId;
    while (padre && !visibles.has(padre)) {
      visibles.add(padre);
      padre = porId.get(padre)?.cuentaPadreId;
    }
  }
  return { coincidencias, visibles };
}

export function valoresDe(cuentas: CuentaLite[], cuenta: CuentaLite | null, padreInicial?: CuentaLite | null): FormValues {
  // Alta de una cuenta hija: hereda clase del padre y sugiere naturaleza. El código
  // se resuelve automático en el componente (no se escribe a mano).
  const claseAlta = padreInicial
    ? (padreInicial.clase as FormValues["clase"])
    : CLASE_CUENTA[0];
  const naturalezaAlta = padreInicial
    ? naturalezaSugerida(padreInicial.clase as ClaseCuenta)
    : NATURALEZA_CUENTA[0];

  return {
    codigoCuenta: cuenta?.codigoCuenta ?? (padreInicial ? siguienteCodigoHijo(padreInicial, cuentas) : siguienteCodigoRaiz(cuentas)),
    nombreCuenta: cuenta?.nombreCuenta ?? "",
    cuentaPadreId: cuenta?.cuentaPadreId ?? padreInicial?.id ?? undefined,
    clase: (cuenta?.clase as FormValues["clase"]) ?? claseAlta,
    naturaleza: (cuenta?.naturaleza as FormValues["naturaleza"]) ?? naturalezaAlta,
    tipoCuenta: (cuenta?.tipoCuenta as FormValues["tipoCuenta"]) ?? "Otra",
    clasificacionCorriente:
      (cuenta?.clasificacionCorriente as FormValues["clasificacionCorriente"]) ?? "No Aplica",
    nivelImputable: cuenta?.nivelImputable ?? true,
    requiereCentroCosto: cuenta?.requiereCentroCosto ?? false,
    requiereAnalisisTerceros: cuenta?.requiereAnalisisTerceros ?? false,
    modoMoneda: (cuenta?.modoMoneda as FormValues["modoMoneda"]) ?? "Funcional",
    monedaFijaId: cuenta?.monedaFijaId ?? undefined,
    relevanteFlujoCaja: cuenta?.relevanteFlujoCaja ?? false,
    esCuentaAjuste: cuenta?.esCuentaAjuste ?? false,
    activa: cuenta?.activa ?? true,
  };
}
