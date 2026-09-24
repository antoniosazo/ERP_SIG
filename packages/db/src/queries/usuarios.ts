import { randomBytes } from "node:crypto";
import type { InvitarUsuarioInput } from "@erp/shared";
import bcrypt from "bcryptjs";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../client";
import { empresas, tokensAcceso, usuarioEmpresa, usuarios } from "../schema";

const SALT_ROUNDS = 12;
const INVITACION_VIGENCIA_HORAS = 24 * 7;
const RESET_VIGENCIA_HORAS = 24;

function generarToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Alta de un contador por invitación (4.9-E). Sin envío de email por ahora: se devuelve
 * el token para que el Administrador copie/comparta el link `/activar/[token]` a mano.
 */
export async function crearUsuarioInvitado(
  firmaContableId: string,
  input: InvitarUsuarioInput,
): Promise<{ usuarioId: string; token: string }> {
  return db.transaction(async (tx) => {
    const [usuario] = await tx
      .insert(usuarios)
      .values({
        firmaContableId,
        nombre: input.nombre,
        email: input.email,
        estado: "Invitado",
        esAdminFirma: input.esAdminFirma,
      })
      .returning({ id: usuarios.id });

    if (!usuario) throw new Error("No se pudo crear el usuario");

    if (input.empresas.length > 0) {
      await tx.insert(usuarioEmpresa).values(
        input.empresas.map((asignacion) => ({
          usuarioId: usuario.id,
          empresaId: asignacion.empresaId,
          rol: asignacion.rol,
        })),
      );
    }

    const token = generarToken();
    const expiraEn = new Date(Date.now() + INVITACION_VIGENCIA_HORAS * 60 * 60 * 1000);
    await tx.insert(tokensAcceso).values({
      usuarioId: usuario.id,
      tipo: "invitacion",
      token,
      expiraEn,
    });

    return { usuarioId: usuario.id, token };
  });
}

/** Genera un link de reseteo de contraseña para un usuario ya activo (mismo mecanismo que la invitación). */
export async function generarTokenReset(usuarioId: string): Promise<string> {
  const token = generarToken();
  const expiraEn = new Date(Date.now() + RESET_VIGENCIA_HORAS * 60 * 60 * 1000);
  await db.insert(tokensAcceso).values({ usuarioId, tipo: "reset_password", token, expiraEn });
  return token;
}

export async function obtenerTokenValido(token: string) {
  const [fila] = await db
    .select({
      id: tokensAcceso.id,
      tipo: tokensAcceso.tipo,
      expiraEn: tokensAcceso.expiraEn,
      usuarioId: tokensAcceso.usuarioId,
      usuarioNombre: usuarios.nombre,
      usuarioEmail: usuarios.email,
    })
    .from(tokensAcceso)
    .innerJoin(usuarios, eq(usuarios.id, tokensAcceso.usuarioId))
    .where(
      and(
        eq(tokensAcceso.token, token),
        isNull(tokensAcceso.usadoEn),
        gt(tokensAcceso.expiraEn, new Date()),
      ),
    );

  return fila ?? null;
}

/** El contador define su contraseña (activación de cuenta nueva o reseteo). */
export async function activarCuentaConToken(token: string, password: string): Promise<boolean> {
  const fila = await obtenerTokenValido(token);
  if (!fila) return false;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await db.transaction(async (tx) => {
    await tx
      .update(usuarios)
      .set({ passwordHash, estado: "Activo" })
      .where(eq(usuarios.id, fila.usuarioId));
    await tx.update(tokensAcceso).set({ usadoEn: new Date() }).where(eq(tokensAcceso.id, fila.id));
  });

  return true;
}

/**
 * Crea un usuario ya Activo con contraseña definida (sin pasar por invitación/token).
 * Uso exclusivo del script de bootstrap (`scripts/bootstrap-firma.ts`) para el primer
 * Administrador de la firma — el resto de los contadores se invitan normalmente.
 */
export async function crearUsuarioActivoConPassword(input: {
  firmaContableId: string;
  nombre: string;
  email: string;
  password: string;
  esAdminFirma?: boolean;
  empresas: { empresaId: string; rol: "Administrador" | "Contador" | "Asistente" }[];
}): Promise<{ usuarioId: string }> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  return db.transaction(async (tx) => {
    const [usuario] = await tx
      .insert(usuarios)
      .values({
        firmaContableId: input.firmaContableId,
        nombre: input.nombre,
        email: input.email,
        passwordHash,
        estado: "Activo",
        esAdminFirma: input.esAdminFirma ?? false,
      })
      .returning({ id: usuarios.id });

    if (!usuario) throw new Error("No se pudo crear el usuario");

    if (input.empresas.length > 0) {
      await tx.insert(usuarioEmpresa).values(
        input.empresas.map((asignacion) => ({
          usuarioId: usuario.id,
          empresaId: asignacion.empresaId,
          rol: asignacion.rol,
        })),
      );
    }

    return { usuarioId: usuario.id };
  });
}

export type UsuarioAutenticado = {
  id: string;
  nombre: string;
  email: string;
  firmaContableId: string;
  esAdminFirma: boolean;
  esSuperAdmin: boolean;
  empresas: { empresaId: string; rol: string }[];
};

/** Valida email+password (login). Devuelve el usuario con sus asignaciones o null si no calza. */
export async function verificarCredenciales(
  email: string,
  password: string,
): Promise<UsuarioAutenticado | null> {
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, email));

  if (!usuario || usuario.estado !== "Activo" || !usuario.passwordHash) return null;

  const coincide = await bcrypt.compare(password, usuario.passwordHash);
  if (!coincide) return null;

  const asignaciones = await db
    .select({ empresaId: usuarioEmpresa.empresaId, rol: usuarioEmpresa.rol })
    .from(usuarioEmpresa)
    .where(eq(usuarioEmpresa.usuarioId, usuario.id));

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    firmaContableId: usuario.firmaContableId,
    esAdminFirma: usuario.esAdminFirma,
    esSuperAdmin: usuario.esSuperAdmin,
    empresas: asignaciones,
  };
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

export async function listarUsuariosDeFirma(firmaContableId: string) {
  const filas = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      estado: usuarios.estado,
      esAdminFirma: usuarios.esAdminFirma,
      empresaId: usuarioEmpresa.empresaId,
      empresaNombre: empresas.razonSocial,
      rol: usuarioEmpresa.rol,
    })
    .from(usuarios)
    .leftJoin(usuarioEmpresa, eq(usuarioEmpresa.usuarioId, usuarios.id))
    .leftJoin(empresas, eq(empresas.id, usuarioEmpresa.empresaId))
    .where(eq(usuarios.firmaContableId, firmaContableId));

  const porUsuario = new Map<
    string,
    {
      id: string;
      nombre: string;
      email: string;
      estado: string;
      esAdminFirma: boolean;
      asignaciones: { empresaId: string; empresaNombre: string; rol: string }[];
    }
  >();

  for (const fila of filas) {
    const existente = porUsuario.get(fila.id) ?? {
      id: fila.id,
      nombre: fila.nombre,
      email: fila.email,
      estado: fila.estado,
      esAdminFirma: fila.esAdminFirma,
      asignaciones: [],
    };
    if (fila.empresaId && fila.empresaNombre) {
      existente.asignaciones.push({
        empresaId: fila.empresaId,
        empresaNombre: fila.empresaNombre,
        rol: fila.rol ?? "",
      });
    }
    porUsuario.set(fila.id, existente);
  }

  return [...porUsuario.values()];
}
