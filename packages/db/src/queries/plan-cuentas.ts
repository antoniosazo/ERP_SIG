import { and, asc, eq, sql } from "drizzle-orm";
import {
  MAX_PROFUNDIDAD_CUENTA,
  type ClaseCuenta,
  type CrearCuentaInput,
  type EditarCuentaInput,
} from "@erp/shared";
import { db } from "../client";
import type { Tx } from "../client";
import { asientosLineas, planCuentas } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

/** ¿La cuenta tiene alguna línea de asiento? Bloquea cambios en campos críticos. */
export async function cuentaTieneMovimientos(
  exec: Pick<typeof db, "select"> | Tx,
  cuentaId: string,
): Promise<boolean> {
  const [row] = await exec
    .select({ n: sql<number>`1` })
    .from(asientosLineas)
    .where(eq(asientosLineas.cuentaId, cuentaId))
    .limit(1);
  return row !== undefined;
}

/** IDs de las cuentas de una empresa que ya tienen movimientos (para la UI). */
export async function cuentasConMovimientos(empresaId: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ cuentaId: asientosLineas.cuentaId })
    .from(asientosLineas)
    .innerJoin(planCuentas, eq(asientosLineas.cuentaId, planCuentas.id))
    .where(eq(planCuentas.empresaId, empresaId));
  return new Set(rows.map((r) => r.cuentaId));
}

/**
 * Clona el árbol de `plan_cuentas` de una plantilla hacia una empresa recién creada
 * (Proceso 0, paso 3 del diseño por proceso). Recorre la jerarquía de raíz hacia hojas
 * y fuerza que cada cuenta hija herede la `clase` de su raíz, tal como exige la regla
 * de "clase fija de nivel 1" (3.2) — nunca se confía en que la plantilla ya venga
 * consistente fila por fila.
 */
export async function clonarPlanDeCuentas(
  tx: Tx,
  plantillaId: string,
  empresaId: string,
): Promise<void> {
  const cuentasPlantilla = await tx
    .select()
    .from(planCuentas)
    .where(eq(planCuentas.plantillaId, plantillaId));

  const idAntiguoANuevo = new Map<string, string>();
  const claseHeredadaPorIdAntiguo = new Map<string, ClaseCuenta>();

  async function clonarHijosDe(padreAntiguoId: string | null, padreNuevoId: string | null) {
    const hijos = cuentasPlantilla.filter((c) => c.cuentaPadreId === padreAntiguoId);
    for (const cuenta of hijos) {
      const clase =
        padreAntiguoId === null
          ? cuenta.clase
          : (claseHeredadaPorIdAntiguo.get(padreAntiguoId) ?? cuenta.clase);

      const [nueva] = await tx
        .insert(planCuentas)
        .values({
          empresaId,
          plantillaId: null,
          cuentaPadreId: padreNuevoId,
          codigoCuenta: cuenta.codigoCuenta,
          nombreCuenta: cuenta.nombreCuenta,
          clase,
          naturaleza: cuenta.naturaleza,
          tipoCuenta: cuenta.tipoCuenta,
          clasificacionCorriente: cuenta.clasificacionCorriente,
          nivelImputable: cuenta.nivelImputable,
          requiereCentroCosto: cuenta.requiereCentroCosto,
          requiereAnalisisTerceros: cuenta.requiereAnalisisTerceros,
          modoMoneda: cuenta.modoMoneda,
          monedaFijaId: null,
          relevanteFlujoCaja: cuenta.relevanteFlujoCaja,
          esCuentaAjuste: cuenta.esCuentaAjuste,
        })
        .returning({ id: planCuentas.id });

      if (!nueva) throw new Error("No se pudo clonar la cuenta " + cuenta.codigoCuenta);

      idAntiguoANuevo.set(cuenta.id, nueva.id);
      claseHeredadaPorIdAntiguo.set(cuenta.id, clase);

      await clonarHijosDe(cuenta.id, nueva.id);
    }
  }

  await clonarHijosDe(null, null);
}

/** Árbol de `plan_cuentas` de una empresa, ordenado por código. */
export async function listarPlanCuentasDeEmpresa(empresaId: string) {
  return db
    .select()
    .from(planCuentas)
    .where(eq(planCuentas.empresaId, empresaId))
    .orderBy(asc(planCuentas.codigoCuenta));
}

/**
 * Resuelve la `clase` que corresponde a una cuenta según la regla de "clase fija de
 * nivel 1" (3.2): una cuenta raíz usa la clase solicitada; una cuenta con padre hereda
 * la clase de su raíz, ignorando la clase que venga en el formulario. Valida además que
 * el padre pertenezca a la misma empresa.
 */
async function resolverClase(
  empresaId: string,
  cuentaPadreId: string | null | undefined,
  claseSolicitada: ClaseCuenta,
): Promise<ClaseCuenta> {
  if (!cuentaPadreId) return claseSolicitada;

  const cuentas = await listarPlanCuentasDeEmpresa(empresaId);
  const porId = new Map(cuentas.map((c) => [c.id, c]));

  let actual = porId.get(cuentaPadreId);
  if (!actual) throw new Error("La cuenta padre no existe en esta empresa");

  const visitados = new Set<string>();
  while (actual.cuentaPadreId) {
    if (visitados.has(actual.id)) throw new Error("Ciclo en la jerarquía de cuentas");
    visitados.add(actual.id);
    const padre = porId.get(actual.cuentaPadreId);
    if (!padre) break;
    actual = padre;
  }
  return actual.clase;
}

type CuentaNodo = { id: string; cuentaPadreId: string | null };

/** Profundidad de una cuenta según la cadena de ancestros: la cuenta raíz es nivel 1. */
function profundidadDeCuenta(cuentas: CuentaNodo[], cuentaId: string): number {
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

/** Altura del subárbol (1 = hoja): cuántos niveles cuelgan de `cuentaId` inclusive. */
function alturaDeSubarbol(hijosPorPadre: Map<string, string[]>, cuentaId: string): number {
  const hijos = hijosPorPadre.get(cuentaId) ?? [];
  if (hijos.length === 0) return 1;
  return 1 + Math.max(...hijos.map((h) => alturaDeSubarbol(hijosPorPadre, h)));
}

const etiquetaCuenta = (c: { codigoCuenta: string; nombreCuenta: string }) =>
  `${c.codigoCuenta} ${c.nombreCuenta}`;

export async function crearCuenta(
  empresaId: string,
  input: CrearCuentaInput,
  ctx?: AuditoriaCtx,
) {
  const clase = await resolverClase(empresaId, input.cuentaPadreId, input.clase);

  // Tope de profundidad: no se puede crear una hija bajo una cuenta que ya está en el nivel máximo.
  if (input.cuentaPadreId) {
    const cuentas = await listarPlanCuentasDeEmpresa(empresaId);
    if (profundidadDeCuenta(cuentas, input.cuentaPadreId) >= MAX_PROFUNDIDAD_CUENTA) {
      throw new Error(
        `El plan de cuentas admite como máximo ${MAX_PROFUNDIDAD_CUENTA} niveles.`,
      );
    }
  }

  return db.transaction(async (tx) => {
    const [cuenta] = await tx
      .insert(planCuentas)
      .values({
        empresaId,
        plantillaId: null,
        cuentaPadreId: input.cuentaPadreId ?? null,
        codigoCuenta: input.codigoCuenta,
        nombreCuenta: input.nombreCuenta,
        clase,
        naturaleza: input.naturaleza,
        tipoCuenta: input.tipoCuenta,
        clasificacionCorriente: input.clasificacionCorriente,
        nivelImputable: input.nivelImputable,
        requiereCentroCosto: input.requiereCentroCosto,
        requiereAnalisisTerceros: input.requiereAnalisisTerceros,
        modoMoneda: input.modoMoneda,
        monedaFijaId: input.modoMoneda === "Extranjera fija" ? (input.monedaFijaId ?? null) : null,
        relevanteFlujoCaja: input.relevanteFlujoCaja,
        esCuentaAjuste: input.esCuentaAjuste,
        activa: input.activa,
      })
      .returning();
    if (!cuenta) throw new Error("No se pudo crear la cuenta");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "plan_cuentas",
        registroId: cuenta.id,
        etiqueta: etiquetaCuenta(cuenta),
        accion: "crear",
        despues: cuenta,
      });
    }
    return cuenta;
  });
}

export async function actualizarCuenta(
  cuentaId: string,
  empresaId: string,
  input: EditarCuentaInput,
  ctx?: AuditoriaCtx,
) {
  if (input.cuentaPadreId === cuentaId) {
    throw new Error("Una cuenta no puede ser su propia cuenta padre");
  }
  const clase = await resolverClase(empresaId, input.cuentaPadreId, input.clase);

  // RN-05: la cuenta padre no puede ser un descendiente de esta cuenta.
  if (input.cuentaPadreId) {
    const cuentasEmpresa = await listarPlanCuentasDeEmpresa(empresaId);
    const hijosPorPadre = new Map<string, string[]>();
    for (const c of cuentasEmpresa) {
      if (!c.cuentaPadreId) continue;
      hijosPorPadre.set(c.cuentaPadreId, [...(hijosPorPadre.get(c.cuentaPadreId) ?? []), c.id]);
    }
    const descendientes = new Set<string>();
    const pila = [cuentaId];
    while (pila.length) {
      const actual = pila.pop()!;
      for (const hijo of hijosPorPadre.get(actual) ?? []) {
        if (!descendientes.has(hijo)) {
          descendientes.add(hijo);
          pila.push(hijo);
        }
      }
    }
    if (descendientes.has(input.cuentaPadreId)) {
      throw new Error("La cuenta padre no puede ser una cuenta descendiente de esta cuenta");
    }

    // Tope de profundidad: nuevo nivel de esta cuenta + alto de su subárbol no puede
    // pasar de MAX_PROFUNDIDAD_CUENTA.
    const nivelNuevo = profundidadDeCuenta(cuentasEmpresa, input.cuentaPadreId) + 1;
    const alto = alturaDeSubarbol(hijosPorPadre, cuentaId);
    if (nivelNuevo + alto - 1 > MAX_PROFUNDIDAD_CUENTA) {
      throw new Error(
        `El plan de cuentas admite como máximo ${MAX_PROFUNDIDAD_CUENTA} niveles.`,
      );
    }
  }

  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(planCuentas)
      .where(and(eq(planCuentas.id, cuentaId), eq(planCuentas.empresaId, empresaId)));
    if (!antes) throw new Error("No se pudo actualizar la cuenta (no existe en esta empresa)");

    // Cuenta principal (raíz de nivel 1): código y nombre son fijos.
    if (
      antes.cuentaPadreId === null &&
      (input.codigoCuenta !== antes.codigoCuenta || input.nombreCuenta !== antes.nombreCuenta)
    ) {
      throw new Error(
        "Las cuentas principales (nivel 1) no permiten cambiar el código ni el nombre.",
      );
    }

    // Inmutabilidad: cuenta con movimientos → no se cambia clase, moneda ni control.
    if (
      (antes.clase !== clase ||
        antes.modoMoneda !== input.modoMoneda ||
        antes.requiereAnalisisTerceros !== input.requiereAnalisisTerceros) &&
      (await cuentaTieneMovimientos(tx, cuentaId))
    ) {
      throw new Error(
        "La cuenta ya tiene movimientos: no se puede cambiar la clase, el modo de moneda ni el flag de control de terceros.",
      );
    }

    const [cuenta] = await tx
      .update(planCuentas)
      .set({
        cuentaPadreId: input.cuentaPadreId ?? null,
        codigoCuenta: input.codigoCuenta,
        nombreCuenta: input.nombreCuenta,
        clase,
        naturaleza: input.naturaleza,
        tipoCuenta: input.tipoCuenta,
        clasificacionCorriente: input.clasificacionCorriente,
        nivelImputable: input.nivelImputable,
        requiereCentroCosto: input.requiereCentroCosto,
        requiereAnalisisTerceros: input.requiereAnalisisTerceros,
        modoMoneda: input.modoMoneda,
        monedaFijaId: input.modoMoneda === "Extranjera fija" ? (input.monedaFijaId ?? null) : null,
        relevanteFlujoCaja: input.relevanteFlujoCaja,
        esCuentaAjuste: input.esCuentaAjuste,
        activa: input.activa,
        updatedAt: new Date(),
      })
      .where(and(eq(planCuentas.id, cuentaId), eq(planCuentas.empresaId, empresaId)))
      .returning();
    if (!cuenta) throw new Error("No se pudo actualizar la cuenta (no existe en esta empresa)");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "plan_cuentas",
        registroId: cuenta.id,
        etiqueta: etiquetaCuenta(cuenta),
        accion: "editar",
        antes,
        despues: cuenta,
      });
    }
    return cuenta;
  });
}
