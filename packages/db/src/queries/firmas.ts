import { randomBytes } from "node:crypto";
import type {
  ActualizarFirmaContableInput,
  CrearFirmaConAdminInput,
  CrearFirmaContableInput,
} from "@erp/shared";
import { asc, eq } from "drizzle-orm";
import { db } from "../client";
import { firmasContables, tokensAcceso, usuarios } from "../schema";

const INVITACION_VIGENCIA_HORAS = 24 * 7;

export async function crearFirmaContable(input: CrearFirmaContableInput) {
  const [firma] = await db.insert(firmasContables).values(input).returning();
  if (!firma) throw new Error("No se pudo crear la firma contable");
  return firma;
}

export async function listarFirmasContables() {
  return db.select().from(firmasContables).orderBy(asc(firmasContables.razonSocial));
}

export async function obtenerFirmaContable(id: string) {
  const [firma] = await db.select().from(firmasContables).where(eq(firmasContables.id, id));
  return firma ?? null;
}

export async function actualizarFirmaContable(id: string, input: ActualizarFirmaContableInput) {
  const [firma] = await db
    .update(firmasContables)
    .set(input)
    .where(eq(firmasContables.id, id))
    .returning();
  if (!firma) throw new Error("No se pudo actualizar la firma contable");
  return firma;
}

/**
 * Alta de una firma contable nueva junto con su primer Administrador (solo superadmin —
 * ver `requireSuperAdmin` en packages/app). Reutiliza el mismo mecanismo de invitación por
 * token que `crearUsuarioInvitado`, en la misma transacción que crea la firma.
 */
export async function crearFirmaConAdmin(
  input: CrearFirmaConAdminInput,
): Promise<{ firmaId: string; usuarioId: string; token: string }> {
  return db.transaction(async (tx) => {
    const [firma] = await tx.insert(firmasContables).values(input.firma).returning({ id: firmasContables.id });
    if (!firma) throw new Error("No se pudo crear la firma contable");

    const [usuario] = await tx
      .insert(usuarios)
      .values({
        firmaContableId: firma.id,
        nombre: input.admin.nombre,
        email: input.admin.email,
        estado: "Invitado",
        esAdminFirma: true,
      })
      .returning({ id: usuarios.id });
    if (!usuario) throw new Error("No se pudo crear el usuario administrador");

    const token = randomBytes(32).toString("hex");
    const expiraEn = new Date(Date.now() + INVITACION_VIGENCIA_HORAS * 60 * 60 * 1000);
    await tx.insert(tokensAcceso).values({ usuarioId: usuario.id, tipo: "invitacion", token, expiraEn });

    return { firmaId: firma.id, usuarioId: usuario.id, token };
  });
}
