import { createHash, randomBytes } from "node:crypto";
import type { InvitarUsuarioInput } from "@erp/shared";
import bcrypt from "bcryptjs";
import { and, asc, eq, gt, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { conFirma, db, dbPlataforma } from "../client";
import { firmasContables, membresias, tokensAcceso, usuarios as cuentas } from "../plataforma/schema";
import { empresas, usuarioEmpresa, usuarios } from "../schema";
import { type AuditoriaCtx, registrarAuditoria } from "./auditoria";

const SALT_ROUNDS = 12;
export const INVITACION_VIGENCIA_HORAS = 24 * 7;
export const RESET_VIGENCIA_HORAS = 24;

// Hash de relleno para comparar contra él cuando el usuario no existe (o no tiene
// password_hash todavía) — sin esto, verificarCredenciales responde casi al instante
// para emails inexistentes y tarda lo que tarda bcrypt para emails reales, filtrando
// por temporización qué emails están activos en el sistema.
const HASH_RELLENO = bcrypt.hashSync("relleno-sin-uso-real", SALT_ROUNDS);

export type Asignacion = { empresaId: string; rol: "Administrador" | "Contador" | "Asistente" };

/** Quién hace la gestión: su identidad queda en la auditoría y decide qué cuentas puede tocar. */
export type ActorGestion = { id: string; nombre: string; esSuperAdmin: boolean };

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

function generarToken(): string {
  return randomBytes(32).toString("hex");
}

/** En la base solo se guarda el hash del link: quien lea la tabla no puede usarlo. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const venceEn = (horas: number) => new Date(Date.now() + horas * 60 * 60 * 1000);

type TxPlataforma = Parameters<Parameters<typeof dbPlataforma.transaction>[0]>[0];

/**
 * Crea un link de invitación o reseteo para la cuenta y deja sin efecto los que tuviera
 * pendientes: solo vale el último. Devuelve el valor del link (el hash es lo único que se guarda).
 */
export async function crearToken(tx: TxPlataforma, usuarioId: string, tipo: "invitacion" | "reset_password", horas: number): Promise<string> {
  await tx.update(tokensAcceso).set({ usadoEn: new Date() }).where(and(eq(tokensAcceso.usuarioId, usuarioId), isNull(tokensAcceso.usadoEn)));
  const token = generarToken();
  await tx.insert(tokensAcceso).values({ usuarioId, tipo, token: hashToken(token), expiraEn: venceEn(horas) });
  return token;
}

/** Falla con un mensaje claro si el email ya es de otra cuenta (sin distinguir mayúsculas). */
export async function exigirEmailLibre(email: string, exceptoUsuarioId?: string) {
  const [existente] = await dbPlataforma
    .select({ id: cuentas.id })
    .from(cuentas)
    .where(and(sql`lower(${cuentas.email}) = ${normalizarEmail(email)}`, exceptoUsuarioId ? ne(cuentas.id, exceptoUsuarioId) : undefined));
  if (existente) throw new Error("Ya existe un usuario con ese email.");
}

/** Cada empresa una sola vez y todas dentro de la base de la firma; si no, un mensaje que se entienda. */
export async function validarAsignaciones(firmaContableId: string, asignaciones: Asignacion[]) {
  const ids = asignaciones.map((a) => a.empresaId);
  if (new Set(ids).size !== ids.length) throw new Error("Cada empresa solo puede asignarse una vez.");
  if (ids.length === 0) return;
  const existentes = await conFirma(firmaContableId, () => db.select({ id: empresas.id }).from(empresas).where(inArray(empresas.id, ids)));
  if (existentes.length !== ids.length) throw new Error("Una de las empresas elegidas no pertenece a esta firma.");
}

/** Deja el evento en la bitácora de la firma (sin empresa: es una acción sobre la cuenta, no sobre una empresa). */
export async function auditarUsuario(
  firmaContableId: string,
  actor: ActorGestion,
  a: { usuarioId: string; etiqueta: string; accion: "crear" | "editar" | "cambio_estado"; antes?: unknown; despues?: unknown; motivo?: string },
) {
  const ctx: AuditoriaCtx = { usuarioId: actor.id, usuarioNombre: actor.nombre, ...(a.motivo ? { motivo: a.motivo } : {}) };
  await conFirma(firmaContableId, () =>
    db.transaction((tx) =>
      registrarAuditoria(tx, { empresaId: null, ctx, tabla: "usuarios", registroId: a.usuarioId, etiqueta: a.etiqueta, accion: a.accion, antes: a.antes, despues: a.despues }),
    ),
  );
}

/**
 * Registra al usuario en la base de la firma: su reflejo y sus roles por empresa (los reemplaza,
 * porque son los de esta firma). La cuenta y su membresía ya existen en la plataforma; si esto
 * falla, quien llama las deshace (no hay transacción entre bases).
 */
async function registrarEnFirma(
  firmaContableId: string,
  usuario: { id: string; nombre: string; email: string },
  asignaciones: Asignacion[],
) {
  await conFirma(firmaContableId, () =>
    db.transaction(async (tx) => {
      await tx.insert(usuarios).values(usuario).onConflictDoNothing({ target: usuarios.id });
      await tx.delete(usuarioEmpresa).where(eq(usuarioEmpresa.usuarioId, usuario.id));
      if (asignaciones.length > 0) {
        await tx.insert(usuarioEmpresa).values(asignaciones.map((a) => ({ usuarioId: usuario.id, empresaId: a.empresaId, rol: a.rol })));
      }
    }),
  );
}

type DatosCuenta = { nombre: string; email: string; esAdminFirma: boolean; esSuperAdmin?: boolean; passwordHash?: string };

/**
 * Cuenta nueva, su membresía en la firma y su invitación (si corresponde), dentro de una
 * transacción de plataforma.
 */
export async function crearCuentaPlataforma(
  tx: TxPlataforma,
  firmaContableId: string,
  datos: DatosCuenta,
  conInvitacion: boolean,
): Promise<{ usuarioId: string; token: string | null }> {
  const [cuenta] = await tx
    .insert(cuentas)
    .values({
      nombre: datos.nombre,
      email: normalizarEmail(datos.email),
      passwordHash: datos.passwordHash ?? null,
      estado: datos.passwordHash ? "Activo" : "Invitado",
      esSuperAdmin: datos.esSuperAdmin ?? false,
    })
    .returning({ id: cuentas.id });
  if (!cuenta) throw new Error("No se pudo crear el usuario");
  await tx.insert(membresias).values({ usuarioId: cuenta.id, firmaContableId, esAdminFirma: datos.esAdminFirma });
  const token = conInvitacion ? await crearToken(tx, cuenta.id, "invitacion", INVITACION_VIGENCIA_HORAS) : null;
  return { usuarioId: cuenta.id, token };
}

async function crearCuenta(
  firmaContableId: string,
  datos: DatosCuenta,
  asignaciones: Asignacion[],
  conInvitacion: boolean,
): Promise<{ usuarioId: string; token: string | null }> {
  // Se valida antes de crear nada: así los errores comunes no dejan una cuenta a medio crear.
  await exigirEmailLibre(datos.email);
  await validarAsignaciones(firmaContableId, asignaciones);
  const { usuarioId, token: valorToken } = await dbPlataforma.transaction((tx) => crearCuentaPlataforma(tx, firmaContableId, datos, conInvitacion));
  try {
    await registrarEnFirma(firmaContableId, { id: usuarioId, nombre: datos.nombre, email: normalizarEmail(datos.email) }, asignaciones);
  } catch (error) {
    await dbPlataforma.delete(cuentas).where(eq(cuentas.id, usuarioId));
    throw error;
  }
  return { usuarioId, token: valorToken };
}

const MENSAJE_YA_EXISTE = "Ya existe un usuario con ese email.";

/**
 * Da acceso a una firma a una cuenta que ya existe (la persona ya trabaja en otra). Solo si ya
 * activó su cuenta, para no dejar a dos firmas disputando el link de una invitación pendiente;
 * y solo con su propia contraseña: la firma no puede cambiársela (ver `generarTokenReset`).
 */
async function agregarCuentaExistenteAFirma(
  firmaContableId: string,
  cuenta: typeof cuentas.$inferSelect,
  esAdminFirma: boolean,
  asignaciones: Asignacion[],
) {
  await validarAsignaciones(firmaContableId, asignaciones);
  await dbPlataforma.insert(membresias).values({ usuarioId: cuenta.id, firmaContableId, esAdminFirma });
  try {
    await registrarEnFirma(firmaContableId, { id: cuenta.id, nombre: cuenta.nombre, email: cuenta.email }, asignaciones);
  } catch (error) {
    await dbPlataforma.delete(membresias).where(and(eq(membresias.usuarioId, cuenta.id), eq(membresias.firmaContableId, firmaContableId)));
    throw error;
  }
}

/**
 * Alta de un usuario en la firma (4.9-E). Si el email es nuevo se crea la cuenta y se devuelve el
 * link de invitación para copiarlo y compartirlo a mano. Si ya hay una cuenta activa con ese
 * email (la persona trabaja en otra firma) se le da acceso a esta firma con su misma cuenta, sin link.
 */
export async function crearUsuarioInvitado(
  firmaContableId: string,
  input: InvitarUsuarioInput,
  actor?: ActorGestion,
): Promise<{ usuarioId: string; token: string | null; yaTeniaCuenta: boolean }> {
  const email = normalizarEmail(input.email);
  const [existente] = await dbPlataforma.select().from(cuentas).where(sql`lower(${cuentas.email}) = ${email}`);
  let resultado: { usuarioId: string; token: string | null; yaTeniaCuenta: boolean };

  if (!existente) {
    const r = await crearCuenta(firmaContableId, { nombre: input.nombre, email, esAdminFirma: input.esAdminFirma }, input.empresas, true);
    resultado = { usuarioId: r.usuarioId, token: r.token, yaTeniaCuenta: false };
  } else {
    // La cuenta de un superadmin no se menciona a quien no lo es: ni siquiera se confirma que existe.
    if (existente.esSuperAdmin && !actor?.esSuperAdmin) throw new Error(MENSAJE_YA_EXISTE);
    const [yaMiembro] = await dbPlataforma
      .select({ id: membresias.id })
      .from(membresias)
      .where(and(eq(membresias.usuarioId, existente.id), eq(membresias.firmaContableId, firmaContableId)));
    if (yaMiembro) throw new Error("Esa persona ya pertenece a esta firma.");
    if (existente.estado !== "Activo") {
      throw new Error("Ese email tiene una invitación pendiente en otra firma: podrás agregarlo cuando active su cuenta.");
    }
    await agregarCuentaExistenteAFirma(firmaContableId, existente, input.esAdminFirma, input.empresas);
    resultado = { usuarioId: existente.id, token: null, yaTeniaCuenta: true };
  }

  if (actor) {
    await auditarUsuario(firmaContableId, actor, {
      usuarioId: resultado.usuarioId,
      etiqueta: email,
      accion: "crear",
      despues: { nombre: input.nombre, email, esAdminFirma: input.esAdminFirma, empresas: input.empresas, ...(resultado.yaTeniaCuenta ? { cuentaExistente: true } : {}) },
    });
  }
  return resultado;
}

/**
 * Asegura que todos los miembros de la firma existan en el reflejo de su base (tras crearla o
 * reintentar su alta). No toca roles: los asigna el Administrador de la firma.
 */
export async function sincronizarUsuariosEnFirma(firmaContableId: string) {
  const lista = await dbPlataforma
    .select({ id: cuentas.id, nombre: cuentas.nombre, email: cuentas.email })
    .from(membresias)
    .innerJoin(cuentas, eq(cuentas.id, membresias.usuarioId))
    .where(eq(membresias.firmaContableId, firmaContableId));
  if (lista.length === 0) return;
  await conFirma(firmaContableId, () => db.insert(usuarios).values(lista).onConflictDoNothing({ target: usuarios.id }));
}

/** Refleja la identidad del superadmin en la firma que va a atender, para auditoría y FKs. */
export async function asegurarSuperadminEnFirma(firmaContableId: string, usuarioId: string) {
  const [cuenta] = await dbPlataforma
    .select({ id: cuentas.id, nombre: cuentas.nombre, email: cuentas.email })
    .from(cuentas)
    .where(and(eq(cuentas.id, usuarioId), eq(cuentas.esSuperAdmin, true), eq(cuentas.estado, "Activo")));
  if (!cuenta) throw new Error("El superadmin no está activo.");
  await conFirma(firmaContableId, () =>
    db.insert(usuarios)
      .values(cuenta)
      .onConflictDoUpdate({ target: usuarios.id, set: { nombre: cuenta.nombre, email: cuenta.email, updatedAt: new Date() } }),
  );
}

/** Links nuevos de invitación para los administradores de la firma que aún no activan su cuenta. */
export async function renovarInvitacionesDeAdministradores(firmaContableId: string) {
  const pendientes = await dbPlataforma
    .select({ id: cuentas.id, email: cuentas.email })
    .from(membresias)
    .innerJoin(cuentas, eq(cuentas.id, membresias.usuarioId))
    .where(and(eq(membresias.firmaContableId, firmaContableId), eq(membresias.esAdminFirma, true), eq(cuentas.estado, "Invitado")));
  const invitaciones: { email: string; token: string }[] = [];
  for (const p of pendientes) {
    const token = await dbPlataforma.transaction((tx) => crearToken(tx, p.id, "invitacion", INVITACION_VIGENCIA_HORAS));
    invitaciones.push({ email: p.email, token });
  }
  return invitaciones;
}

/**
 * Crea un usuario ya Activo con contraseña definida (sin pasar por invitación/token).
 * Uso exclusivo del script de alta de firmas por consola.
 */
export async function crearUsuarioActivoConPassword(input: {
  firmaContableId: string;
  nombre: string;
  email: string;
  password: string;
  esAdminFirma?: boolean;
  esSuperAdmin?: boolean;
  empresas: Asignacion[];
}): Promise<{ usuarioId: string }> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const r = await crearCuenta(
    input.firmaContableId,
    { nombre: input.nombre, email: input.email, esAdminFirma: input.esAdminFirma ?? false, esSuperAdmin: input.esSuperAdmin, passwordHash },
    input.empresas,
    false,
  );
  return { usuarioId: r.usuarioId };
}

export async function obtenerTokenValido(token: string) {
  const [fila] = await dbPlataforma
    .select({
      id: tokensAcceso.id,
      tipo: tokensAcceso.tipo,
      expiraEn: tokensAcceso.expiraEn,
      usuarioId: tokensAcceso.usuarioId,
      usuarioNombre: cuentas.nombre,
      usuarioEmail: cuentas.email,
    })
    .from(tokensAcceso)
    .innerJoin(cuentas, eq(cuentas.id, tokensAcceso.usuarioId))
    .where(
      and(
        eq(tokensAcceso.token, hashToken(token)),
        isNull(tokensAcceso.usadoEn),
        gt(tokensAcceso.expiraEn, new Date()),
        // Un link no sirve para reactivar a quien fue suspendido en todas sus firmas.
        sql`exists (select 1 from ${membresias} where ${membresias.usuarioId} = ${cuentas.id} and ${membresias.estado} = 'Activa')`,
      ),
    );

  return fila ?? null;
}

/** El contador define su contraseña (activación de cuenta nueva o reseteo). */
export async function activarCuentaConToken(token: string, password: string): Promise<boolean> {
  const fila = await obtenerTokenValido(token);
  if (!fila) return false;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await dbPlataforma.transaction(async (tx) => {
    await tx.update(cuentas).set({ passwordHash, estado: "Activo", updatedAt: new Date() }).where(eq(cuentas.id, fila.usuarioId));
    await tx.update(tokensAcceso).set({ usadoEn: new Date() }).where(and(eq(tokensAcceso.usuarioId, fila.usuarioId), isNull(tokensAcceso.usadoEn)));
  });
  return true;
}

export type FirmaDeUsuario = { id: string; nombre: string; esAdminFirma: boolean };
export type EmpresaConRol = { empresaId: string; rol: string };
/** A qué firmas entra una cuenta (membresías vigentes de firmas activas) y con qué rol en cada empresa. */
export type AccesoDeUsuario = {
  esSuperAdmin: boolean;
  firmas: FirmaDeUsuario[];
  empresasPorFirma: Record<string, EmpresaConRol[]>;
};
export type UsuarioAutenticado = AccesoDeUsuario & { id: string; nombre: string; email: string };

async function firmasDeUsuario(usuarioId: string): Promise<FirmaDeUsuario[]> {
  return dbPlataforma
    .select({ id: firmasContables.id, nombre: firmasContables.razonSocial, esAdminFirma: membresias.esAdminFirma })
    .from(membresias)
    .innerJoin(firmasContables, eq(firmasContables.id, membresias.firmaContableId))
    .where(and(eq(membresias.usuarioId, usuarioId), eq(membresias.estado, "Activa"), eq(firmasContables.estado, "Activa")))
    .orderBy(asc(firmasContables.razonSocial));
}

/** Roles por empresa en cada firma. Si la base de una firma no responde, esa firma queda sin roles; las demás siguen. */
async function rolesPorFirma(usuarioId: string, firmas: FirmaDeUsuario[]): Promise<Record<string, EmpresaConRol[]>> {
  const filas = await Promise.all(
    firmas.map(async (f) => {
      try {
        const roles = await conFirma(f.id, () =>
          db.select({ empresaId: usuarioEmpresa.empresaId, rol: usuarioEmpresa.rol }).from(usuarioEmpresa).where(eq(usuarioEmpresa.usuarioId, usuarioId)),
        );
        return [f.id, roles] as const;
      } catch {
        return [f.id, []] as const;
      }
    }),
  );
  return Object.fromEntries(filas);
}

async function accesoDe(usuarioId: string, esSuperAdmin: boolean): Promise<AccesoDeUsuario | null> {
  const firmas = await firmasDeUsuario(usuarioId);
  // Sin ninguna firma vigente no hay a dónde entrar, salvo el superadmin, que elige cualquiera.
  if (!esSuperAdmin && firmas.length === 0) return null;
  return { esSuperAdmin, firmas, empresasPorFirma: await rolesPorFirma(usuarioId, firmas) };
}

/**
 * Valida email+password (login) contra la plataforma y trae las firmas a las que entra y sus roles
 * por empresa. Devuelve null si no calza o si la cuenta no tiene ninguna firma vigente.
 */
export async function verificarCredenciales(email: string, password: string): Promise<UsuarioAutenticado | null> {
  const [cuenta] = await dbPlataforma.select().from(cuentas).where(sql`lower(${cuentas.email}) = ${normalizarEmail(email)}`);
  const valido = !!cuenta && cuenta.estado === "Activo" && !!cuenta.passwordHash;

  // Siempre se corre bcrypt (contra el hash real o el de relleno) para que el tiempo de
  // respuesta no delate si el email existe/está activo.
  const coincide = await bcrypt.compare(password, valido ? cuenta.passwordHash! : HASH_RELLENO);
  if (!valido || !cuenta || !coincide) return null;

  const acceso = await accesoDe(cuenta.id, cuenta.esSuperAdmin);
  if (!acceso) return null;
  return { id: cuenta.id, nombre: cuenta.nombre, email: cuenta.email, ...acceso };
}

/**
 * Acceso vigente de una cuenta: null si ya no está activa o se quedó sin firmas vigentes (la sesión
 * debe cerrarse). Si sigue vigente, devuelve sus firmas, permisos y roles actuales para refrescar la sesión.
 */
export async function sesionVigente(usuarioId: string): Promise<AccesoDeUsuario | null> {
  const [cuenta] = await dbPlataforma.select({ estado: cuentas.estado, esSuperAdmin: cuentas.esSuperAdmin }).from(cuentas).where(eq(cuentas.id, usuarioId));
  if (!cuenta || cuenta.estado !== "Activo") return null;
  return accesoDe(usuarioId, cuenta.esSuperAdmin);
}

/** ¿Sigue siendo superadmin una cuenta activa? Consulta liviana, para comprobarlo en cada petición. */
export async function esSuperAdminVigente(usuarioId: string): Promise<boolean> {
  const [cuenta] = await dbPlataforma
    .select({ id: cuentas.id })
    .from(cuentas)
    .where(and(eq(cuentas.id, usuarioId), eq(cuentas.estado, "Activo"), eq(cuentas.esSuperAdmin, true)));
  return !!cuenta;
}

/** Usuarios con acceso a una empresa (para el campo "Vendedor" de los documentos). */
export async function listarUsuariosDeEmpresa(empresaId: string) {
  return db
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarioEmpresa)
    .innerJoin(usuarios, eq(usuarios.id, usuarioEmpresa.usuarioId))
    .where(eq(usuarioEmpresa.empresaId, empresaId))
    .orderBy(asc(usuarios.nombre));
}

/** Usuarios de la firma (cuentas con membresía) con sus empresas y roles (base de la firma). */
export async function listarUsuariosDeFirma(firmaContableId: string) {
  const miembros = await dbPlataforma
    .select({
      id: cuentas.id,
      nombre: cuentas.nombre,
      email: cuentas.email,
      cuentaEstado: cuentas.estado,
      membresiaEstado: membresias.estado,
      esAdminFirma: membresias.esAdminFirma,
      esSuperAdmin: cuentas.esSuperAdmin,
      tieneClave: sql<boolean>`${cuentas.passwordHash} is not null`,
      otrasFirmas: sql<number>`(select count(*)::int from ${membresias} m2 where m2.usuario_id = ${cuentas.id} and m2.firma_contable_id <> ${firmaContableId})`,
    })
    .from(membresias)
    .innerJoin(cuentas, eq(cuentas.id, membresias.usuarioId))
    .where(eq(membresias.firmaContableId, firmaContableId))
    .orderBy(asc(cuentas.nombre));
  if (miembros.length === 0) return [];

  const ids = miembros.map((u) => u.id);
  const [asignaciones, invitaciones] = await Promise.all([
    conFirma(firmaContableId, () =>
      db
        .select({ usuarioId: usuarioEmpresa.usuarioId, empresaId: usuarioEmpresa.empresaId, empresaNombre: empresas.razonSocial, rol: usuarioEmpresa.rol })
        .from(usuarioEmpresa)
        .innerJoin(empresas, eq(empresas.id, usuarioEmpresa.empresaId))
        .where(inArray(usuarioEmpresa.usuarioId, ids)),
    ),
    dbPlataforma
      .select({ usuarioId: tokensAcceso.usuarioId, venceEn: max(tokensAcceso.expiraEn) })
      .from(tokensAcceso)
      .where(and(inArray(tokensAcceso.usuarioId, ids), eq(tokensAcceso.tipo, "invitacion"), isNull(tokensAcceso.usadoEn)))
      .groupBy(tokensAcceso.usuarioId),
  ]);

  const ahora = Date.now();
  return miembros.map(({ cuentaEstado, membresiaEstado, ...u }) => {
    // Lo que se muestra: suspendido en esta firma (o en toda la plataforma) o el estado de la cuenta.
    const estado = membresiaEstado === "Suspendida" || cuentaEstado === "Suspendido" ? "Suspendido" : cuentaEstado;
    const vence = invitaciones.find((i) => i.usuarioId === u.id)?.venceEn ?? null;
    return {
      ...u,
      estado,
      /** Cuándo vence el link de invitación pendiente (ISO); null si no hay uno sin usar. */
      invitacionVenceEn: vence?.toISOString() ?? null,
      /** Invitación pendiente cuyo link ya venció (o no existe): hay que reenviarla. */
      invitacionVencida: estado === "Invitado" && (!vence || vence.getTime() < ahora),
      asignaciones: asignaciones
        .filter((a) => a.usuarioId === u.id)
        .map((a) => ({ empresaId: a.empresaId, empresaNombre: a.empresaNombre, rol: a.rol })),
    };
  });
}
