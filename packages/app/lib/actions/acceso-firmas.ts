"use server";

import { asegurarSuperadminEnFirma, obtenerFirmaContable } from "@erp/db";
import { uuid } from "@erp/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, requireSuperAdmin } from "@/lib/auth-helpers";
import { COOKIE_FIRMA_ACTIVA, crearFirmaActiva, VIGENCIA_FIRMA_ACTIVA_SEG } from "@/lib/firma-activa";

export type EntrarFirmaResultado = { ok: true } | { ok: false; error: string };

async function fijarFirmaActiva(usuarioId: string, firmaId: string) {
  (await cookies()).set(COOKIE_FIRMA_ACTIVA, crearFirmaActiva(usuarioId, firmaId), {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VIGENCIA_FIRMA_ACTIVA_SEG,
  });
}

/**
 * Abre una firma lista con la identidad real del superadmin, sin usar credenciales del cliente.
 * Si no es miembro de esa firma, su identidad se refleja en ella para que las acciones queden a su nombre.
 */
export async function entrarFirmaAction(firmaId: string): Promise<EntrarFirmaResultado> {
  const session = await requireSuperAdmin();
  if (!uuid.safeParse(firmaId).success) return { ok: false, error: "Firma inválida." };

  const firma = await obtenerFirmaContable(firmaId);
  if (!firma) return { ok: false, error: "La firma ya no existe." };
  if (firma.estado !== "Activa") return { ok: false, error: "Activa la firma antes de entrar." };
  if (firma.estadoBase !== "lista") return { ok: false, error: "La base de esta firma todavía no está lista." };

  if (!session.user.firmas.some((f) => f.id === firma.id)) {
    try {
      await asegurarSuperadminEnFirma(firma.id, session.user.id);
    } catch {
      return { ok: false, error: "No se pudo abrir la base de esta firma. Revisa su estado e inténtalo de nuevo." };
    }
  }
  await fijarFirmaActiva(session.user.id, firma.id);
  return { ok: true };
}

/** Elige con qué firma trabajar entre las que el usuario tiene vigentes. */
export async function elegirFirmaAction(firmaId: string): Promise<EntrarFirmaResultado> {
  const session = await requireSession();
  if (!uuid.safeParse(firmaId).success) return { ok: false, error: "Firma inválida." };
  if (!session.user.firmas.some((f) => f.id === firmaId)) return { ok: false, error: "No tienes acceso a esa firma." };
  await fijarFirmaActiva(session.user.id, firmaId);
  return { ok: true };
}

/** Superadmin: vuelve a la lista de firmas. */
export async function salirFirmaAction(): Promise<void> {
  await requireSuperAdmin();
  (await cookies()).delete(COOKIE_FIRMA_ACTIVA);
  redirect("/superadmin/firmas");
}

/** Quien pertenece a varias firmas: vuelve a elegir con cuál trabajar. */
export async function cambiarDeFirmaAction(): Promise<void> {
  await requireSession();
  (await cookies()).delete(COOKIE_FIRMA_ACTIVA);
  redirect("/elegir-firma");
}
