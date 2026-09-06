import type { GuardarReglaDeterminacionInput } from "@erp/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { planCuentas, reglasDeterminacionCuenta } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

/** Reglas GENERAL de determinación de cuenta de una empresa. */
export async function listarReglasDeterminacion(empresaId: string) {
  return db
    .select()
    .from(reglasDeterminacionCuenta)
    .where(eq(reglasDeterminacionCuenta.empresaId, empresaId))
    .orderBy(reglasDeterminacionCuenta.contexto, reglasDeterminacionCuenta.rol);
}

/**
 * Fija (o borra, si `cuentaId` es null) la regla GENERAL para un `(contexto, rol)`.
 * RN-07: la cuenta debe ser imputable, activa y de la empresa.
 */
export async function guardarReglaDeterminacion(
  empresaId: string,
  input: GuardarReglaDeterminacionInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(reglasDeterminacionCuenta)
      .where(
        and(
          eq(reglasDeterminacionCuenta.empresaId, empresaId),
          eq(reglasDeterminacionCuenta.contexto, input.contexto),
          eq(reglasDeterminacionCuenta.rol, input.rol),
        ),
      );
    const etiqueta = `${input.contexto} / ${input.rol}`;

    if (!input.cuentaId) {
      if (antes) {
        await tx
          .delete(reglasDeterminacionCuenta)
          .where(eq(reglasDeterminacionCuenta.id, antes.id));
        if (ctx) {
          await registrarAuditoria(tx, {
            empresaId,
            ctx,
            tabla: "reglas_determinacion_cuenta",
            registroId: antes.id,
            etiqueta,
            accion: "eliminar",
            antes,
          });
        }
      }
      return null;
    }

    const [cuenta] = await tx
      .select({ activa: planCuentas.activa, nivelImputable: planCuentas.nivelImputable })
      .from(planCuentas)
      .where(and(eq(planCuentas.id, input.cuentaId), eq(planCuentas.empresaId, empresaId)));
    if (!cuenta) throw new Error("La cuenta no existe en esta empresa");
    if (!cuenta.activa) throw new Error("La cuenta está inactiva");
    if (!cuenta.nivelImputable) {
      throw new Error("La regla debe apuntar a una cuenta imputable (que reciba movimientos)");
    }

    const [regla] = await tx
      .insert(reglasDeterminacionCuenta)
      .values({ empresaId, contexto: input.contexto, rol: input.rol, cuentaId: input.cuentaId })
      .onConflictDoUpdate({
        target: [
          reglasDeterminacionCuenta.empresaId,
          reglasDeterminacionCuenta.contexto,
          reglasDeterminacionCuenta.rol,
        ],
        set: { cuentaId: input.cuentaId, updatedAt: new Date() },
      })
      .returning();
    if (!regla) throw new Error("No se pudo guardar la regla");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "reglas_determinacion_cuenta",
        registroId: regla.id,
        etiqueta,
        accion: antes ? "editar" : "crear",
        antes: antes ?? undefined,
        despues: regla,
      });
    }
    return regla;
  });
}

/** Cuenta de la regla GENERAL para `(contexto, rol)`, o `null` si no está definida. */
export async function resolverCuentaGeneral(
  exec: Pick<typeof db, "select"> | Tx,
  empresaId: string,
  contexto: GuardarReglaDeterminacionInput["contexto"],
  rol: GuardarReglaDeterminacionInput["rol"],
): Promise<string | null> {
  const [row] = await exec
    .select({ cuentaId: reglasDeterminacionCuenta.cuentaId })
    .from(reglasDeterminacionCuenta)
    .where(
      and(
        eq(reglasDeterminacionCuenta.empresaId, empresaId),
        eq(reglasDeterminacionCuenta.contexto, contexto),
        eq(reglasDeterminacionCuenta.rol, rol),
      ),
    );
  return row?.cuentaId ?? null;
}
