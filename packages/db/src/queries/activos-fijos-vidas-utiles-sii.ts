import type { CrearVidaUtilSiiInput } from "@erp/shared";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "../client";
import { activosFijosVidasUtilesSii } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

/** Catálogo de vidas útiles SII: filas globales (plantilla) + propias de la empresa. */
export async function listarVidasUtilesSii(empresaId: string) {
  return db
    .select()
    .from(activosFijosVidasUtilesSii)
    .where(or(isNull(activosFijosVidasUtilesSii.empresaId), eq(activosFijosVidasUtilesSii.empresaId, empresaId)))
    .orderBy(asc(activosFijosVidasUtilesSii.categoria));
}

export async function crearVidaUtilSii(empresaId: string, input: CrearVidaUtilSiiInput, ctx?: AuditoriaCtx) {
  return db.transaction(async (tx) => {
    const [fila] = await tx
      .insert(activosFijosVidasUtilesSii)
      .values({ empresaId, ...input })
      .returning();
    if (!fila) throw new Error("No se pudo crear la vida útil");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "activos_fijos_vidas_utiles_sii",
        registroId: fila.id,
        etiqueta: fila.categoria,
        accion: "crear",
        despues: fila,
      });
    }
    return fila;
  });
}

/**
 * Subconjunto representativo de la tabla oficial del SII (Resolución Ex. N°43 del
 * 26/12/2002, vigente desde 01/01/2003) — no la tabla completa (tiene cientos de
 * líneas). Se siembra una sola vez, como filas globales (`empresaId = null`). La firma
 * agrega las categorías propias de sus clientes que no estén aquí.
 */
const VIDAS_UTILES_SII_BASE: { categoria: string; descripcion: string; anios: number }[] = [
  { categoria: "Camiones de uso general", descripcion: "Vehículos motorizados", anios: 7 },
  { categoria: "Camionetas y jeeps", descripcion: "Vehículos motorizados", anios: 7 },
  { categoria: "Automóviles", descripcion: "Vehículos motorizados", anios: 7 },
  { categoria: "Motos", descripcion: "Vehículos motorizados", anios: 7 },
  { categoria: "Sistemas computacionales y periféricos", descripcion: "Equipos de computación", anios: 6 },
  { categoria: "Útiles de oficina", descripcion: "Muebles y útiles de oficina", anios: 3 },
  { categoria: "Muebles y enseres", descripcion: "Muebles y útiles de oficina", anios: 7 },
  { categoria: "Maquinarias y equipos en general", descripcion: "Maquinaria industrial", anios: 15 },
  { categoria: "Edificios (muros de ladrillo/hormigón, estructura armada)", descripcion: "Construcciones", anios: 50 },
  { categoria: "Construcciones de acero (estructura, cubierta, entrepisos)", descripcion: "Construcciones", anios: 80 },
  { categoria: "Construcciones de adobe o madera", descripcion: "Construcciones", anios: 30 },
  { categoria: "Instalaciones en general (eléctricas, de oficina)", descripcion: "Instalaciones", anios: 10 },
  { categoria: "Herramientas pesadas", descripcion: "Herramientas", anios: 8 },
  { categoria: "Herramientas livianas", descripcion: "Herramientas", anios: 3 },
];

/**
 * Siembra el subconjunto global de vidas útiles SII, si todavía no existe. Se corre una
 * sola vez, no por empresa — es una tabla de referencia global. Idempotente por
 * verificación manual (no `onConflictDoNothing`: el índice único de filas globales es
 * parcial — `where empresa_id is null` — y Postgres no empareja `ON CONFLICT` con un
 * índice parcial solo por columnas).
 */
export async function sembrarVidasUtilesSiiGlobal(): Promise<number> {
  const existentes = await db
    .select({ categoria: activosFijosVidasUtilesSii.categoria })
    .from(activosFijosVidasUtilesSii)
    .where(
      and(
        isNull(activosFijosVidasUtilesSii.empresaId),
        inArray(activosFijosVidasUtilesSii.categoria, VIDAS_UTILES_SII_BASE.map((v) => v.categoria)),
      ),
    );
  const yaExisten = new Set(existentes.map((e) => e.categoria));
  const faltantes = VIDAS_UTILES_SII_BASE.filter((v) => !yaExisten.has(v.categoria));
  if (faltantes.length === 0) return 0;

  const filas = await db
    .insert(activosFijosVidasUtilesSii)
    .values(
      faltantes.map((v) => ({
        empresaId: null,
        categoria: v.categoria,
        descripcion: `${v.descripcion} — Resolución Ex. SII N°43/2002. Verifica vigencia con la tabla oficial actual antes de usar.`,
        vidaUtilNormalMeses: v.anios * 12,
        activa: true,
      })),
    )
    .returning({ id: activosFijosVidasUtilesSii.id });
  return filas.length;
}
