import type { ActualizarFirmaContableInput, CrearFirmaContableInput } from "@erp/shared";
import { asc, eq } from "drizzle-orm";
import { db } from "../client";
import { firmasContables } from "../schema";

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
