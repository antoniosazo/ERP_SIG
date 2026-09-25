import type {
  CrearClaseActivoFijoInput,
  EditarClaseActivoFijoInput,
  GuardarCuentasClaseInput,
  LibroContable,
} from "@erp/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import { activosFijosClases, activosFijosClasesCuentas, planCuentas } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { resolverCuentaGeneral } from "./reglas-determinacion-cuenta";

/** Clases de activo de una empresa (AF_CLASE), ordenadas por código. */
export async function listarClasesActivoFijo(empresaId: string) {
  return db
    .select()
    .from(activosFijosClases)
    .where(eq(activosFijosClases.empresaId, empresaId))
    .orderBy(asc(activosFijosClases.codigo));
}

/** Cuentas directas configuradas para una clase, por libro. */
export async function listarCuentasClase(claseId: string) {
  return db
    .select()
    .from(activosFijosClasesCuentas)
    .where(eq(activosFijosClasesCuentas.claseId, claseId));
}

/** Cuentas directas de todas las clases de una empresa, por libro (evita N+1 en el listado). */
export async function listarCuentasClasesDeEmpresa(empresaId: string) {
  return db
    .select({
      claseId: activosFijosClasesCuentas.claseId,
      libro: activosFijosClasesCuentas.libro,
      ctaActivo: activosFijosClasesCuentas.ctaActivo,
      ctaDepAcumulada: activosFijosClasesCuentas.ctaDepAcumulada,
      ctaGastoDep: activosFijosClasesCuentas.ctaGastoDep,
      ctaCompensacionCapitalizacion: activosFijosClasesCuentas.ctaCompensacionCapitalizacion,
      ctaUtilidadBaja: activosFijosClasesCuentas.ctaUtilidadBaja,
      ctaPerdidaBaja: activosFijosClasesCuentas.ctaPerdidaBaja,
      ctaValorLibroBaja: activosFijosClasesCuentas.ctaValorLibroBaja,
    })
    .from(activosFijosClasesCuentas)
    .innerJoin(activosFijosClases, eq(activosFijosClasesCuentas.claseId, activosFijosClases.id))
    .where(eq(activosFijosClases.empresaId, empresaId));
}

export async function crearClaseActivoFijo(
  empresaId: string,
  input: CrearClaseActivoFijoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [clase] = await tx
      .insert(activosFijosClases)
      .values({ empresaId, ...input })
      .returning();
    if (!clase) throw new Error("No se pudo crear la clase de activo");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos_clases",
        registroId: clase.id,
        etiqueta: `${clase.codigo} — ${clase.nombre}`,
        accion: "crear",
        despues: clase,
      });
    }
    return clase;
  });
}

export async function actualizarClaseActivoFijo(
  claseId: string,
  empresaId: string,
  input: EditarClaseActivoFijoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(activosFijosClases)
      .where(and(eq(activosFijosClases.id, claseId), eq(activosFijosClases.empresaId, empresaId)));
    if (!antes) throw new Error("La clase de activo no existe en esta empresa");

    const [clase] = await tx
      .update(activosFijosClases)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(activosFijosClases.id, claseId), eq(activosFijosClases.empresaId, empresaId)))
      .returning();
    if (!clase) throw new Error("No se pudo actualizar la clase de activo");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos_clases",
        registroId: clase.id,
        etiqueta: `${clase.codigo} — ${clase.nombre}`,
        accion: "editar",
        antes,
        despues: clase,
      });
    }
    return clase;
  });
}

/** Fija las cuentas directas de una clase para un libro (upsert por `(claseId, libro)`). */
export async function guardarCuentasClase(
  claseId: string,
  empresaId: string,
  input: GuardarCuentasClaseInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const [clase] = await tx
      .select({ id: activosFijosClases.id, codigo: activosFijosClases.codigo, nombre: activosFijosClases.nombre })
      .from(activosFijosClases)
      .where(and(eq(activosFijosClases.id, claseId), eq(activosFijosClases.empresaId, empresaId)));
    if (!clase) throw new Error("La clase de activo no existe en esta empresa");

    const cuentaIds = [
      input.ctaActivo,
      input.ctaDepAcumulada,
      input.ctaGastoDep,
      input.ctaCompensacionCapitalizacion,
      input.ctaUtilidadBaja,
      input.ctaPerdidaBaja,
      input.ctaValorLibroBaja,
    ].filter((x): x is string => !!x);
    if (cuentaIds.length) {
      const rows = await tx
        .select({ id: planCuentas.id })
        .from(planCuentas)
        .where(and(eq(planCuentas.empresaId, empresaId), eq(planCuentas.activa, true), eq(planCuentas.nivelImputable, true)));
      const validas = new Set(rows.map((r) => r.id));
      for (const id of cuentaIds) {
        if (!validas.has(id)) throw new Error("Una de las cuentas seleccionadas no es válida (debe ser imputable y activa)");
      }
    }

    const [fila] = await tx
      .insert(activosFijosClasesCuentas)
      .values({
        claseId,
        libro: input.libro,
        ctaActivo: input.ctaActivo ?? null,
        ctaDepAcumulada: input.ctaDepAcumulada ?? null,
        ctaGastoDep: input.ctaGastoDep ?? null,
        ctaCompensacionCapitalizacion: input.ctaCompensacionCapitalizacion ?? null,
        ctaUtilidadBaja: input.ctaUtilidadBaja ?? null,
        ctaPerdidaBaja: input.ctaPerdidaBaja ?? null,
        ctaValorLibroBaja: input.ctaValorLibroBaja ?? null,
      })
      .onConflictDoUpdate({
        target: [activosFijosClasesCuentas.claseId, activosFijosClasesCuentas.libro],
        set: {
          ctaActivo: input.ctaActivo ?? null,
          ctaDepAcumulada: input.ctaDepAcumulada ?? null,
          ctaGastoDep: input.ctaGastoDep ?? null,
          ctaCompensacionCapitalizacion: input.ctaCompensacionCapitalizacion ?? null,
          ctaUtilidadBaja: input.ctaUtilidadBaja ?? null,
          ctaPerdidaBaja: input.ctaPerdidaBaja ?? null,
          ctaValorLibroBaja: input.ctaValorLibroBaja ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!fila) throw new Error("No se pudieron guardar las cuentas de la clase");

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos_clases_cuentas",
        registroId: `${claseId}/${input.libro}`,
        etiqueta: `${clase.codigo} — ${clase.nombre} (${input.libro})`,
        accion: "editar",
        despues: fila,
      });
    }
    return fila;
  });
}

/**
 * Cuenta de una clase para un rol y libro, con caída al rol GENERAL de
 * `reglas_determinacion_cuenta` si la clase no tiene su propia cuenta configurada
 * (mismo patrón de dos niveles que ya usan clientes/proveedores).
 */
export async function resolverCuentaClase(
  exec: Tx,
  empresaId: string,
  claseId: string,
  libro: LibroContable,
  rol:
    | "ctaActivo"
    | "ctaDepAcumulada"
    | "ctaGastoDep"
    | "ctaCompensacionCapitalizacion"
    | "ctaUtilidadBaja"
    | "ctaPerdidaBaja"
    | "ctaValorLibroBaja",
  rolGeneral:
    | "activo_fijo"
    | "depreciacion_acumulada"
    | "gasto_depreciacion"
    | "cuenta_compensacion_capitalizacion"
    | "utilidad_baja"
    | "perdida_baja"
    | "valor_libro_baja",
): Promise<string | null> {
  const [fila] = await exec
    .select()
    .from(activosFijosClasesCuentas)
    .where(and(eq(activosFijosClasesCuentas.claseId, claseId), eq(activosFijosClasesCuentas.libro, libro)));
  const directa = fila?.[rol] ?? null;
  if (directa) return directa;
  return resolverCuentaGeneral(exec, empresaId, "general", rolGeneral);
}
