import type { CrearMonedaInput, EditarMonedaInput } from "@erp/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { monedas } from "../schema";
import { empresaTieneAsientos } from "./asientos";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

const etiquetaMoneda = (m: { codigo: string; nombre: string }) => `${m.codigo} — ${m.nombre}`;

const MONEDA_CONGELADA =
  "No se puede modificar la moneda: la empresa ya tiene transacciones contables registradas.";

/** Monedas plantilla (globales, `empresa_id IS NULL`) — se usan en el alta de empresa. */
export async function listarMonedasPlantilla() {
  return db.select().from(monedas).where(isNull(monedas.empresaId)).orderBy(asc(monedas.codigo));
}

/** Lista de monedas propia de una empresa. */
export async function listarMonedasDeEmpresa(empresaId: string) {
  return db
    .select()
    .from(monedas)
    .where(eq(monedas.empresaId, empresaId))
    .orderBy(asc(monedas.codigo));
}

/**
 * Clona las monedas plantilla hacia la lista propia de una empresa recién creada
 * (mismo patrón que `clonarPlanDeCuentas`). Devuelve `Map<codigo, nuevoId>` para
 * repuntar `empresas.moneda_funcional_id` / `moneda_reporte_id`.
 */
export async function clonarMonedas(tx: Tx, empresaId: string): Promise<Map<string, string>> {
  const plantillas = await tx.select().from(monedas).where(isNull(monedas.empresaId));
  const mapa = new Map<string, string>();

  for (const m of plantillas) {
    const [nueva] = await tx
      .insert(monedas)
      .values({
        empresaId,
        codigo: m.codigo,
        nombre: m.nombre,
        tipo: m.tipo,
        simbolo: m.simbolo,
        decimales: m.decimales,
        codigoIso: m.codigoIso,
      })
      .returning({ id: monedas.id });
    if (!nueva) throw new Error(`No se pudo clonar la moneda ${m.codigo}`);
    mapa.set(m.codigo, nueva.id);
  }

  return mapa;
}

function valoresMoneda(input: CrearMonedaInput | EditarMonedaInput) {
  return {
    codigo: input.codigo,
    nombre: input.nombre,
    tipo: input.tipo,
    simbolo: input.simbolo,
    decimales: input.decimales,
    codigoIso: input.codigoIso ?? null,
  };
}

export async function crearMoneda(
  empresaId: string,
  input: CrearMonedaInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [moneda] = await tx
      .insert(monedas)
      .values({ empresaId, ...valoresMoneda(input) })
      .returning();
    if (!moneda) throw new Error("No se pudo crear la moneda");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "monedas",
        registroId: moneda.id,
        etiqueta: etiquetaMoneda(moneda),
        accion: "crear",
        despues: moneda,
      });
    }
    return moneda;
  });
}

export async function actualizarMoneda(
  monedaId: string,
  empresaId: string,
  input: EditarMonedaInput,
  ctx?: AuditoriaCtx,
) {
  if (await empresaTieneAsientos(empresaId)) throw new Error(MONEDA_CONGELADA);

  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(monedas)
      .where(and(eq(monedas.id, monedaId), eq(monedas.empresaId, empresaId)));
    if (!antes) throw new Error("No se pudo actualizar la moneda (no existe en esta empresa)");

    const [moneda] = await tx
      .update(monedas)
      .set({ ...valoresMoneda(input), updatedAt: new Date() })
      .where(and(eq(monedas.id, monedaId), eq(monedas.empresaId, empresaId)))
      .returning();
    if (!moneda) throw new Error("No se pudo actualizar la moneda (no existe en esta empresa)");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "monedas",
        registroId: moneda.id,
        etiqueta: etiquetaMoneda(moneda),
        accion: "editar",
        antes,
        despues: moneda,
      });
    }
    return moneda;
  });
}

export async function eliminarMoneda(monedaId: string, empresaId: string, ctx?: AuditoriaCtx) {
  if (await empresaTieneAsientos(empresaId)) throw new Error(MONEDA_CONGELADA);

  return db.transaction(async (tx) => {
    const [moneda] = await tx
      .delete(monedas)
      .where(and(eq(monedas.id, monedaId), eq(monedas.empresaId, empresaId)))
      .returning();
    if (!moneda) throw new Error("No se pudo eliminar la moneda (no existe en esta empresa)");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "monedas",
        registroId: moneda.id,
        etiqueta: etiquetaMoneda(moneda),
        accion: "eliminar",
        antes: moneda,
      });
    }
    return moneda;
  });
}
