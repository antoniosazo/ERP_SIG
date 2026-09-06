"use server";

import { guardarTiposCambio } from "@erp/db";
import { guardarTiposCambioSchema, type GuardarTiposCambioInput } from "@erp/shared";
import { revalidatePath } from "next/cache";
import { requireRolEnEmpresa } from "@/lib/auth-helpers";

export type GuardarTiposCambioResultado =
  | { ok: true; guardados: number; borrados: number }
  | { ok: false; error: string };

export async function guardarTiposCambioAction(
  empresaId: string,
  input: GuardarTiposCambioInput,
): Promise<GuardarTiposCambioResultado> {
  await requireRolEnEmpresa(empresaId, ["Administrador", "Contador"]);

  const parsed = guardarTiposCambioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const { guardados, borrados } = await guardarTiposCambio(empresaId, parsed.data.cambios);
    revalidatePath(`/panel/${empresaId}/configuracion/tipos-cambio`);
    return { ok: true, guardados, borrados };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}
