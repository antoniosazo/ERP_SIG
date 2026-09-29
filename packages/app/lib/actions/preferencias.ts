"use server";

import { guardarPreferenciaFormulario } from "@erp/db";
import { configFormularioDocSchema } from "@erp/shared";
import { requireSession } from "@/lib/auth-helpers";
import { CLAVE_FORM_DOC_COMPRA } from "@/lib/documento-compra-campos";
import { CLAVE_FORM_DOC_VENTA } from "@/lib/documento-venta-campos";

export type GuardarConfigResultado = { ok: true } | { ok: false; error: string };

async function guardarConfigFormularioDoc(
  clave: string,
  configRaw: unknown,
): Promise<GuardarConfigResultado> {
  const session = await requireSession();
  const parsed = configFormularioDocSchema.safeParse(configRaw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Configuración inválida" };
  }
  try {
    await guardarPreferenciaFormulario(session.user.id, clave, parsed.data);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

/** Guarda el orden y la visibilidad de los campos de documentos de venta. */
export async function guardarConfigFormularioDocVentaAction(configRaw: unknown) {
  return guardarConfigFormularioDoc(CLAVE_FORM_DOC_VENTA, configRaw);
}

/** Guarda el orden y la visibilidad de los campos de documentos de compra. */
export async function guardarConfigFormularioDocCompraAction(configRaw: unknown) {
  return guardarConfigFormularioDoc(CLAVE_FORM_DOC_COMPRA, configRaw);
}
