"use server";

import { guardarPreferenciaFormulario } from "@erp/db";
import { configFormularioDocSchema } from "@erp/shared";
import { requireSession } from "@/lib/auth-helpers";
import { CLAVE_FORM_DOC_VENTA } from "@/lib/documento-venta-campos";

export type GuardarConfigResultado = { ok: true } | { ok: false; error: string };

/** Guarda la config de formulario (orden + visibilidad) del usuario para los documentos de venta. */
export async function guardarConfigFormularioDocVentaAction(
  configRaw: unknown,
): Promise<GuardarConfigResultado> {
  const session = await requireSession();
  const parsed = configFormularioDocSchema.safeParse(configRaw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Configuración inválida" };
  }
  try {
    await guardarPreferenciaFormulario(session.user.id, CLAVE_FORM_DOC_VENTA, parsed.data);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}
