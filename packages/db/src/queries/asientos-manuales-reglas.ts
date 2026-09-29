import type { AsientoLineaManualInput, LibroContable } from "@erp/shared";

type CuentaMaestro = {
  id: string;
  codigoCuenta: string;
  nombreCuenta: string;
  activa: boolean;
  nivelImputable: boolean;
  tipoCuenta: string;
  requiereCentroCosto: boolean;
  requiereAnalisisTerceros: boolean;
  modoMoneda: string;
};
type TerceroMaestro = { id: string; razonSocial: string; activo: boolean };
type CentroCostoMaestro = { id: string; codigo: string; estado: string };

export type MaestrosAsiento = {
  cuentas: ReadonlyMap<string, CuentaMaestro>;
  terceros: ReadonlyMap<string, TerceroMaestro>;
  centrosCosto: ReadonlyMap<string, CentroCostoMaestro>;
  /** Cuenta asociada (de control) de cada socio: tercero → grupo → regla general. */
  cuentaDeTercero: ReadonlyMap<string, string | null>;
};

export type LineaResuelta = {
  cuentaId: string;
  terceroId: string | null;
  centroCostoId: string | null;
  glosa: string | null;
  debe: number;
  haber: number;
};

/** Cuentas de control: su saldo es la cuenta corriente de los socios, por eso exigen socio. */
const CUENTAS_DE_CONTROL = new Set(["Cliente", "Proveedor"]);

/** Estados de período que admiten asientos manuales (SAP: "Desbloqueado" y "Período de cierre"). */
export function periodoAdmiteAsientoManual(estado: string): boolean {
  return estado === "Desbloqueado" || estado === "Período de cierre";
}

export function validarLibro(libro: LibroContable, aplicaIfrs: boolean) {
  if (!aplicaIfrs && libro !== "Ambos") {
    throw new Error("La empresa no lleva doble libro (IFRS): el asiento debe ser del libro Ambos");
  }
}

/**
 * Valida cada línea contra los maestros de la empresa y completa la cuenta cuando solo se
 * indicó el socio (como el "Código SN" de SAP B1, que contabiliza en su cuenta asociada).
 * Los maps deben contener solo registros de la empresa: lo que no esté, no le pertenece.
 */
export function resolverLineasAsiento(
  lineas: readonly AsientoLineaManualInput[],
  m: MaestrosAsiento,
  glosaCabecera: string,
): LineaResuelta[] {
  return lineas.map((l, i) => {
    const n = `Línea ${i + 1}`;
    const tercero = l.terceroId ? m.terceros.get(l.terceroId) : undefined;
    if (l.terceroId && !tercero) throw new Error(`${n}: el socio de negocio no existe en esta empresa`);
    if (tercero && !tercero.activo) throw new Error(`${n}: el socio ${tercero.razonSocial} está inactivo`);

    let cuentaId = l.cuentaId ?? null;
    if (!cuentaId && tercero) {
      cuentaId = m.cuentaDeTercero.get(tercero.id) ?? null;
      if (!cuentaId) {
        throw new Error(`${n}: ${tercero.razonSocial} no tiene cuenta asociada (ni su grupo, ni regla general); indica la cuenta`);
      }
    }
    if (!cuentaId) throw new Error(`${n}: indica una cuenta o un socio de negocio`);

    const cuenta = m.cuentas.get(cuentaId);
    if (!cuenta) throw new Error(`${n}: la cuenta no existe en esta empresa`);
    const etiqueta = `${cuenta.codigoCuenta} ${cuenta.nombreCuenta}`;
    if (!cuenta.activa) throw new Error(`${n}: la cuenta ${etiqueta} está inactiva`);
    if (!cuenta.nivelImputable) throw new Error(`${n}: la cuenta ${etiqueta} es de título (no imputable)`);
    if (cuenta.modoMoneda === "Extranjera fija") {
      throw new Error(`${n}: la cuenta ${etiqueta} es en moneda extranjera; los asientos manuales en moneda extranjera aún no están habilitados`);
    }
    if (CUENTAS_DE_CONTROL.has(cuenta.tipoCuenta) && !tercero) {
      throw new Error(`${n}: la cuenta ${etiqueta} es de control (${cuenta.tipoCuenta}); indica el socio de negocio`);
    }
    if (cuenta.requiereAnalisisTerceros && !tercero) {
      throw new Error(`${n}: la cuenta ${etiqueta} exige socio de negocio`);
    }

    const cc = l.centroCostoId ? m.centrosCosto.get(l.centroCostoId) : undefined;
    if (l.centroCostoId && !cc) throw new Error(`${n}: el centro de costo no existe en esta empresa`);
    if (cc && cc.estado !== "Activo") throw new Error(`${n}: el centro de costo ${cc.codigo} está inactivo`);
    if (cuenta.requiereCentroCosto && !cc) throw new Error(`${n}: la cuenta ${etiqueta} exige centro de costo`);

    return {
      cuentaId,
      terceroId: tercero?.id ?? null,
      centroCostoId: cc?.id ?? null,
      // Como en SAP, la glosa de la cabecera se propaga a las líneas que no traen la suya.
      glosa: l.glosa?.trim() || glosaCabecera,
      debe: Math.round(l.debe * 100) / 100,
      haber: Math.round(l.haber * 100) / 100,
    };
  });
}
