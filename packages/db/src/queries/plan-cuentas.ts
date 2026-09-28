import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  type ClaseCuenta,
  type CrearCuentaInput,
  type EditarCuentaInput,
} from "@erp/shared";
import { db } from "../client";
import type { Tx } from "../client";
import { asientosLineas, monedas, planCuentas } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { planificarCuenta, validarMonedaCuenta } from "./plan-cuentas-reglas";

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

/** Serializa las ediciones del árbol y mantiene las validaciones dentro de la transacción. */
async function cargarPlanParaEdicion(tx: Tx, empresaId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`plan-cuentas:${empresaId}`}))`);
  return tx.select().from(planCuentas).where(eq(planCuentas.empresaId, empresaId)).orderBy(asc(planCuentas.id)).for("update");
}

async function comprobarMoneda(tx: Tx, empresaId: string, monedaFijaId: string | null) {
  if (!monedaFijaId) return;
  const [moneda] = await tx.select({ id: monedas.id, empresaId: monedas.empresaId }).from(monedas)
    .where(and(eq(monedas.id, monedaFijaId), eq(monedas.empresaId, empresaId)));
  validarMonedaCuenta(monedaFijaId, empresaId, moneda);
}

const etiquetaCuenta = (c: { codigoCuenta: string; nombreCuenta: string }) =>
  `${c.codigoCuenta} ${c.nombreCuenta}`;

export async function crearCuenta(empresaId: string, input: CrearCuentaInput, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const plan = await cargarPlanParaEdicion(tx, empresaId);
    const { clase, monedaFijaId } = planificarCuenta(plan, input);
    await comprobarMoneda(tx, empresaId, monedaFijaId);
    const [cuenta] = await tx.insert(planCuentas).values({
      ...input, empresaId, plantillaId: null, cuentaPadreId: input.cuentaPadreId ?? null, clase, monedaFijaId,
    }).returning();
    if (!cuenta) throw new Error("No se pudo crear la cuenta");
    if (ctx) await registrarAuditoria(tx, {
      empresaId, ctx, tabla: "plan_cuentas", registroId: cuenta.id,
      etiqueta: etiquetaCuenta(cuenta), accion: "crear", despues: cuenta,
    });
    return cuenta;
  });
}

export async function actualizarCuenta(cuentaId: string, empresaId: string, input: EditarCuentaInput, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const plan = await cargarPlanParaEdicion(tx, empresaId);
    const movimientos = await tx.selectDistinct({ cuentaId: asientosLineas.cuentaId }).from(asientosLineas)
      .innerJoin(planCuentas, eq(asientosLineas.cuentaId, planCuentas.id))
      .where(eq(planCuentas.empresaId, empresaId));
    const { clase, monedaFijaId, cambios } = planificarCuenta(plan, input, cuentaId, new Set(movimientos.map((m) => m.cuentaId)));
    await comprobarMoneda(tx, empresaId, monedaFijaId);
    const porId = new Map(plan.map((c) => [c.id, c]));
    // Libera los códigos viejos antes de asignar los definitivos: evita colisiones
    // intermedias al renumerar. Ningún código temporal sale de esta transacción.
    for (const cambio of cambios) {
      if (cambio.codigoCuenta !== porId.get(cambio.id)!.codigoCuenta) {
        await tx.update(planCuentas).set({ codigoCuenta: `~${randomUUID()}` })
          .where(and(eq(planCuentas.id, cambio.id), eq(planCuentas.empresaId, empresaId)));
      }
    }
    let actualizada: (typeof plan)[number] | undefined;
    for (const cambio of cambios) {
      const antes = porId.get(cambio.id)!;
      if (cambio.id !== cuentaId && cambio.clase === antes.clase && cambio.codigoCuenta === antes.codigoCuenta) continue;
      const valores = cambio.id === cuentaId
        ? { ...input, cuentaPadreId: input.cuentaPadreId ?? null, clase, monedaFijaId }
        : { clase: cambio.clase, codigoCuenta: cambio.codigoCuenta };
      const [cuenta] = await tx.update(planCuentas).set({ ...valores, updatedAt: new Date() })
        .where(and(eq(planCuentas.id, cambio.id), eq(planCuentas.empresaId, empresaId))).returning();
      if (!cuenta) throw new Error("No se pudo actualizar la cuenta");
      if (cuenta.id === cuentaId) actualizada = cuenta;
      if (ctx) await registrarAuditoria(tx, {
        empresaId, ctx, tabla: "plan_cuentas", registroId: cuenta.id,
        etiqueta: etiquetaCuenta(cuenta), accion: "editar", antes, despues: cuenta,
      });
    }
    if (!actualizada) throw new Error("No se pudo actualizar la cuenta");
    return actualizada;
  });
}
