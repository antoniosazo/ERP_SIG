import type { GuardarTiposCambioInput } from "@erp/shared";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../client";
import { monedas, tiposCambio } from "../schema";
import { rangoDelMes } from "./periodos";

/** Valores de tipo de cambio de las monedas de una empresa dentro de un mes calendario. */
export async function listarTiposCambioDeEmpresaMes(
  empresaId: string,
  anio: number,
  mes: number,
) {
  const { fechaInicio, fechaFin } = rangoDelMes(
    `${anio}-${String(mes).padStart(2, "0")}-01`,
  );
  return db
    .select({
      monedaId: tiposCambio.monedaId,
      fecha: tiposCambio.fecha,
      valorEnClp: tiposCambio.valorEnClp,
      origen: tiposCambio.origen,
    })
    .from(tiposCambio)
    .innerJoin(monedas, eq(tiposCambio.monedaId, monedas.id))
    .where(
      and(
        eq(monedas.empresaId, empresaId),
        gte(tiposCambio.fecha, fechaInicio),
        lte(tiposCambio.fecha, fechaFin),
      ),
    )
    .orderBy(asc(tiposCambio.fecha));
}

/**
 * Carga manual de tipos de cambio: recibe el diff de la grilla (una entrada por celda
 * cambiada). `valor === null` borra la celda; con valor hace upsert sobre `(fecha, moneda_id)`.
 * Rechaza cualquier `monedaId` que no pertenezca a la empresa.
 */
export async function guardarTiposCambio(
  empresaId: string,
  cambios: GuardarTiposCambioInput["cambios"],
): Promise<{ guardados: number; borrados: number }> {
  if (cambios.length === 0) return { guardados: 0, borrados: 0 };

  const idsMoneda = new Set(cambios.map((c) => c.monedaId));
  const propias = await db
    .select({ id: monedas.id })
    .from(monedas)
    .where(and(eq(monedas.empresaId, empresaId), inArray(monedas.id, [...idsMoneda])));
  const validas = new Set(propias.map((m) => m.id));
  for (const c of cambios) {
    if (!validas.has(c.monedaId)) {
      throw new Error("Una de las monedas no pertenece a esta empresa");
    }
  }

  let guardados = 0;
  let borrados = 0;

  await db.transaction(async (tx) => {
    for (const c of cambios) {
      if (c.valor === null) {
        await tx
          .delete(tiposCambio)
          .where(and(eq(tiposCambio.fecha, c.fecha), eq(tiposCambio.monedaId, c.monedaId)));
        borrados += 1;
      } else {
        await tx
          .insert(tiposCambio)
          .values({
            fecha: c.fecha,
            monedaId: c.monedaId,
            valorEnClp: c.valor.toString(),
            origen: "Manual",
          })
          .onConflictDoUpdate({
            target: [tiposCambio.fecha, tiposCambio.monedaId],
            set: { valorEnClp: c.valor.toString(), origen: "Manual", updatedAt: new Date() },
          });
        guardados += 1;
      }
    }
  });

  return { guardados, borrados };
}
