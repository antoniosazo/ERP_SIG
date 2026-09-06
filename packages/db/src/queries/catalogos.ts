import { asc } from "drizzle-orm";
import { db } from "../client";
import { bancos, planCuentasPlantillas, tiposDocumento } from "../schema";

/** Catálogos globales usados para poblar selects en el asistente de alta de empresa. */
export async function listarPlanCuentasPlantillas() {
  return db.select().from(planCuentasPlantillas).orderBy(asc(planCuentasPlantillas.nombre));
}

export async function listarTiposDocumento() {
  return db.select().from(tiposDocumento).orderBy(asc(tiposDocumento.codigoSii));
}

export async function listarBancos() {
  return db.select().from(bancos).orderBy(asc(bancos.nombre));
}
