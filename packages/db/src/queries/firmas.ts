import { randomUUID } from "node:crypto";
import type {
  ActualizarFirmaContableInput,
  CrearFirmaConAdminInput,
  CrearFirmaContableInput,
} from "@erp/shared";
import { asc, eq, sql } from "drizzle-orm";
import { dbPlataforma } from "../client";
import { prepararBaseFirma, proveedorPorDefecto } from "../plataforma/bases";
import { firmasContables, membresias, usuarios as cuentas } from "../plataforma/schema";
import { crearCuentaPlataforma, normalizarEmail, renovarInvitacionesDeAdministradores, sincronizarUsuariosEnFirma } from "./usuarios";

/** Columnas de la firma que se pueden mostrar: todas menos la conexión cifrada de su base. */
const columnasFirma = {
  id: firmasContables.id,
  rut: firmasContables.rut,
  razonSocial: firmasContables.razonSocial,
  planContratado: firmasContables.planContratado,
  estado: firmasContables.estado,
  proveedor: firmasContables.proveedor,
  neonProyectoId: firmasContables.neonProyectoId,
  region: firmasContables.region,
  baseDatos: firmasContables.baseDatos,
  estadoBase: firmasContables.estadoBase,
  versionEsquema: firmasContables.versionEsquema,
  migradaEn: firmasContables.migradaEn,
  errorMigracion: firmasContables.errorMigracion,
  createdAt: firmasContables.createdAt,
  updatedAt: firmasContables.updatedAt,
};

type TxPlataforma = Parameters<Parameters<typeof dbPlataforma.transaction>[0]>[0];

async function registrarFirma(tx: TxPlataforma, input: CrearFirmaContableInput, region?: string) {
  const [firma] = await tx
    .insert(firmasContables)
    .values({ ...input, id: randomUUID(), proveedor: proveedorPorDefecto(), region: region ?? null })
    .returning({ id: firmasContables.id });
  if (!firma) throw new Error("No se pudo crear la firma contable");
  return firma.id;
}

/** La base existe (o se crea), migrada y con catálogos, y con el reflejo de sus usuarios. */
async function dejarBaseLista(firmaId: string) {
  await prepararBaseFirma(firmaId);
  await sincronizarUsuariosEnFirma(firmaId);
}

/**
 * Registra la firma en la plataforma y le crea su base (un proyecto Neon, o una base en el
 * servidor propio en desarrollo), migrada y con catálogos. Si algo falla, la firma queda con
 * `estadoBase = "error"`; `reintentarBaseFirma` reutiliza lo ya creado.
 */
export async function crearFirmaContable(input: CrearFirmaContableInput, opciones: { region?: string } = {}) {
  const firmaId = await dbPlataforma.transaction((tx) => registrarFirma(tx, input, opciones.region));
  await dejarBaseLista(firmaId);
  return (await obtenerFirmaContable(firmaId))!;
}

/**
 * Reintenta el alta de la base de una firma que quedó en error (no crea un segundo proyecto) y
 * devuelve links nuevos de invitación para sus administradores que aún no activan la cuenta.
 */
export async function reintentarBaseFirma(firmaId: string) {
  await dejarBaseLista(firmaId);
  return renovarInvitacionesDeAdministradores(firmaId);
}

export async function listarFirmasContables() {
  return dbPlataforma.select(columnasFirma).from(firmasContables).orderBy(asc(firmasContables.razonSocial));
}

export async function obtenerFirmaContable(id: string) {
  const [firma] = await dbPlataforma.select(columnasFirma).from(firmasContables).where(eq(firmasContables.id, id));
  return firma ?? null;
}

export async function actualizarFirmaContable(id: string, input: ActualizarFirmaContableInput) {
  const [firma] = await dbPlataforma
    .update(firmasContables)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(firmasContables.id, id))
    .returning(columnasFirma);
  if (!firma) throw new Error("No se pudo actualizar la firma contable");
  return firma;
}

export async function actualizarPerfilFirma(id: string, razonSocial: string) {
  const [firma] = await dbPlataforma
    .update(firmasContables)
    .set({ razonSocial, updatedAt: new Date() })
    .where(eq(firmasContables.id, id))
    .returning(columnasFirma);
  if (!firma) throw new Error("No se pudo actualizar la firma contable");
  return firma;
}

/**
 * Alta de una firma contable nueva con su base y su primer Administrador (solo superadmin — ver
 * `requireSuperAdmin` en packages/app). La firma y el administrador se registran juntos: un email
 * repetido no deja una firma huérfana. Si el email ya tiene una cuenta activa (la persona trabaja en
 * otra firma) se le da acceso de administrador con esa misma cuenta y no hay link de invitación; si
 * no, se crea la cuenta y se devuelve el link. Si después falla la base, la firma queda en error y
 * `reintentarBaseFirma` termina el alta.
 */
export async function crearFirmaConAdmin(
  input: CrearFirmaConAdminInput,
): Promise<{ firmaId: string; usuarioId: string; token: string | null; yaTeniaCuenta: boolean }> {
  const email = normalizarEmail(input.admin.email);
  const [existente] = await dbPlataforma.select().from(cuentas).where(sql`lower(${cuentas.email}) = ${email}`);
  if (existente && existente.estado !== "Activo") {
    throw new Error("Ese email tiene una invitación pendiente en otra firma: podrás asignarlo cuando active su cuenta.");
  }
  const registrada = await dbPlataforma.transaction(async (tx) => {
    const firmaId = await registrarFirma(tx, input.firma);
    if (existente) {
      await tx.insert(membresias).values({ usuarioId: existente.id, firmaContableId: firmaId, esAdminFirma: true });
      return { firmaId, usuarioId: existente.id, token: null, yaTeniaCuenta: true };
    }
    const cuenta = await crearCuentaPlataforma(tx, firmaId, { ...input.admin, email, esAdminFirma: true }, true);
    return { firmaId, usuarioId: cuenta.usuarioId, token: cuenta.token, yaTeniaCuenta: false };
  });
  await dejarBaseLista(registrada.firmaId);
  return registrada;
}
