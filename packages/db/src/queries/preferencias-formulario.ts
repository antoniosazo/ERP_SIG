import type { ConfigFormularioDoc } from "@erp/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { preferenciasFormulario } from "../schema";

/** Config de formulario de un usuario para una `clave` (o `null` si no ha guardado nada). */
export async function obtenerPreferenciaFormulario(
  usuarioId: string,
  clave: string,
): Promise<ConfigFormularioDoc | null> {
  const [row] = await db
    .select({ config: preferenciasFormulario.config })
    .from(preferenciasFormulario)
    .where(
      and(
        eq(preferenciasFormulario.usuarioId, usuarioId),
        eq(preferenciasFormulario.clave, clave),
      ),
    );
  return (row?.config as ConfigFormularioDoc | undefined) ?? null;
}

/** Upsert de la config de formulario de un usuario para una `clave`. */
export async function guardarPreferenciaFormulario(
  usuarioId: string,
  clave: string,
  config: ConfigFormularioDoc,
) {
  await db
    .insert(preferenciasFormulario)
    .values({ usuarioId, clave, config })
    .onConflictDoUpdate({
      target: [preferenciasFormulario.usuarioId, preferenciasFormulario.clave],
      set: { config, updatedAt: new Date() },
    });
}
