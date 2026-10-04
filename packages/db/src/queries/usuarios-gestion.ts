import type { EditarUsuarioInput } from "@erp/shared";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { conFirma, db, dbPlataforma } from "../client";
import { membresias, tokensAcceso, usuarios as cuentas } from "../plataforma/schema";
import { bitacoraAuditoria, usuarioEmpresa, usuarios } from "../schema";
import {
  type ActorGestion,
  auditarUsuario,
  crearToken,
  exigirEmailLibre,
  INVITACION_VIGENCIA_HORAS,
  normalizarEmail,
  RESET_VIGENCIA_HORAS,
  validarAsignaciones,
} from "./usuarios";

/**
 * Gestión de los usuarios de una firma por su administrador: suspender, reactivar, editar, reenviar
 * la invitación y resetear la contraseña. Suspender y editar nivel, empresas y roles afectan solo a
 * esta firma (la membresía). Cambiar la contraseña, el nombre o el email afecta a la cuenta, que si
 * trabaja en otras firmas les da acceso a todas: eso solo se permite sobre cuentas que pertenecen
 * únicamente a esta firma. Un administrador de firma nunca toca la cuenta de un superadmin. Todo
 * queda en la bitácora de la firma.
 */

type Cuenta = typeof cuentas.$inferSelect;
type Membresia = typeof membresias.$inferSelect;
type Miembro = { cuenta: Cuenta; membresia: Membresia; otrasFirmas: number };

async function miembroDeFirma(firmaContableId: string, usuarioId: string, actor: ActorGestion): Promise<Miembro> {
  const [fila] = await dbPlataforma
    .select({
      cuenta: cuentas,
      membresia: membresias,
      otrasFirmas: sql<number>`(select count(*)::int from ${membresias} m2 where m2.usuario_id = ${cuentas.id} and m2.firma_contable_id <> ${firmaContableId})`,
    })
    .from(membresias)
    .innerJoin(cuentas, eq(cuentas.id, membresias.usuarioId))
    .where(and(eq(membresias.usuarioId, usuarioId), eq(membresias.firmaContableId, firmaContableId)));
  if (!fila) throw new Error("El usuario no pertenece a tu firma.");
  if (fila.cuenta.esSuperAdmin && !actor.esSuperAdmin) throw new Error("Solo un superadmin puede gestionar la cuenta de un superadmin.");
  return fila;
}

const COMPARTIDA = "Esta persona también trabaja en otras firmas";

/** La firma no puede quedarse sin nadie que la administre. */
async function exigirOtroAdministradorActivo(firmaContableId: string, exceptoUsuarioId: string) {
  const [fila] = await dbPlataforma
    .select({ n: sql<number>`count(*)::int` })
    .from(membresias)
    .innerJoin(cuentas, eq(cuentas.id, membresias.usuarioId))
    .where(
      and(
        eq(membresias.firmaContableId, firmaContableId),
        eq(membresias.esAdminFirma, true),
        eq(membresias.estado, "Activa"),
        eq(cuentas.estado, "Activo"),
        ne(cuentas.id, exceptoUsuarioId),
      ),
    );
  if (!fila || fila.n === 0) throw new Error("Debe quedar al menos un administrador activo en la firma.");
}

/** Anula los links pendientes de una cuenta cuando ya no le queda ninguna firma vigente. */
async function anularLinksSiSinFirmas(usuarioId: string) {
  const [vigentes] = await dbPlataforma
    .select({ n: sql<number>`count(*)::int` })
    .from(membresias)
    .where(and(eq(membresias.usuarioId, usuarioId), eq(membresias.estado, "Activa")));
  if ((vigentes?.n ?? 0) === 0) {
    await dbPlataforma.update(tokensAcceso).set({ usadoEn: new Date() }).where(and(eq(tokensAcceso.usuarioId, usuarioId), isNull(tokensAcceso.usadoEn)));
  }
}

/**
 * Genera un link de reseteo de contraseña (mismo mecanismo que la invitación). Solo para cuentas
 * activas que pertenecen únicamente a esta firma: el link permite tomar la cuenta, y si la persona
 * trabaja en otras firmas se las daría. Queda auditado y deja sin efecto cualquier otro link pendiente.
 */
export async function generarTokenReset(usuarioId: string, firmaContableId: string, actor: ActorGestion): Promise<string> {
  const { cuenta, membresia, otrasFirmas } = await miembroDeFirma(firmaContableId, usuarioId, actor);
  if (membresia.estado === "Suspendida") throw new Error("La cuenta está suspendida: reactívala antes de resetear su contraseña.");
  if (cuenta.estado === "Invitado") throw new Error("Aún no activó su cuenta: reenvía la invitación.");
  if (otrasFirmas > 0 && !actor.esSuperAdmin) {
    throw new Error(`${COMPARTIDA}: solo ella o un superadmin pueden cambiar su contraseña.`);
  }
  const token = await dbPlataforma.transaction((tx) => crearToken(tx, usuarioId, "reset_password", RESET_VIGENCIA_HORAS));
  await auditarUsuario(firmaContableId, actor, { usuarioId, etiqueta: cuenta.email, accion: "editar", despues: { evento: "reseteo_de_contraseña" } });
  return token;
}

/** Nuevo link de invitación para quien aún no activa su cuenta (el anterior deja de valer). */
export async function reenviarInvitacion(usuarioId: string, firmaContableId: string, actor: ActorGestion): Promise<string> {
  const { cuenta, membresia } = await miembroDeFirma(firmaContableId, usuarioId, actor);
  if (cuenta.estado !== "Invitado") throw new Error("Solo se reenvía la invitación a quien aún no activa su cuenta.");
  if (membresia.estado === "Suspendida") throw new Error("La cuenta está suspendida: reactívala antes de reenviar la invitación.");
  const token = await dbPlataforma.transaction((tx) => crearToken(tx, usuarioId, "invitacion", INVITACION_VIGENCIA_HORAS));
  await auditarUsuario(firmaContableId, actor, { usuarioId, etiqueta: cuenta.email, accion: "editar", despues: { evento: "invitación_reenviada" } });
  return token;
}

/**
 * Suspende o reactiva el acceso de una persona a esta firma; su acceso a otras firmas no cambia.
 * Suspender impide entrar a esta firma, cierra las sesiones abiertas en pocos minutos y, si era su
 * única firma vigente, anula sus links pendientes. Reactivar devuelve el acceso; la persona queda
 * "Activa", o "Invitada" si nunca definió contraseña (hay que reenviarle la invitación).
 */
export async function cambiarEstadoUsuario(
  usuarioId: string,
  firmaContableId: string,
  accion: "suspender" | "reactivar",
  actor: ActorGestion,
  motivo?: string,
): Promise<{ estado: "Activo" | "Invitado" | "Suspendido" }> {
  const { cuenta, membresia } = await miembroDeFirma(firmaContableId, usuarioId, actor);

  if (accion === "suspender") {
    if (usuarioId === actor.id) throw new Error("No puedes suspender tu propia cuenta.");
    if (membresia.estado === "Suspendida") throw new Error("La cuenta ya está suspendida.");
    if (membresia.esAdminFirma && cuenta.estado === "Activo") await exigirOtroAdministradorActivo(firmaContableId, usuarioId);
    await dbPlataforma
      .update(membresias)
      .set({ estado: "Suspendida", updatedAt: new Date() })
      .where(and(eq(membresias.usuarioId, usuarioId), eq(membresias.firmaContableId, firmaContableId)));
    await anularLinksSiSinFirmas(usuarioId);
    await auditarUsuario(firmaContableId, actor, {
      usuarioId, etiqueta: cuenta.email, accion: "cambio_estado", antes: { estado: membresia.estado }, despues: { estado: "Suspendida" }, motivo,
    });
    return { estado: "Suspendido" };
  }

  if (membresia.estado !== "Suspendida") throw new Error("Solo se reactivan cuentas suspendidas.");
  await dbPlataforma
    .update(membresias)
    .set({ estado: "Activa", updatedAt: new Date() })
    .where(and(eq(membresias.usuarioId, usuarioId), eq(membresias.firmaContableId, firmaContableId)));
  const estado = cuenta.estado === "Activo" ? "Activo" : "Invitado";
  await auditarUsuario(firmaContableId, actor, {
    usuarioId, etiqueta: cuenta.email, accion: "cambio_estado", antes: { estado: "Suspendida" }, despues: { estado: "Activa" }, motivo,
  });
  return { estado };
}

/**
 * Edita nivel de administrador y empresas con su rol en esta firma, y el nombre y email de la cuenta
 * solo si pertenece únicamente a esta firma (el email, además, solo mientras siga "Invitada"). Nadie
 * cambia su propio nivel de administrador, y la firma conserva siempre un administrador activo. La
 * plataforma y el reflejo en la base de la firma se actualizan juntos; si el segundo falla, la
 * plataforma vuelve a como estaba.
 */
export async function editarUsuario(usuarioId: string, firmaContableId: string, input: EditarUsuarioInput, actor: ActorGestion): Promise<void> {
  const { cuenta, membresia, otrasFirmas } = await miembroDeFirma(firmaContableId, usuarioId, actor);
  const email = input.email === undefined ? cuenta.email : normalizarEmail(input.email);
  // El nivel de administrador de un superadmin no se toca desde la firma.
  const esAdminFirma = cuenta.esSuperAdmin ? membresia.esAdminFirma : input.esAdminFirma;

  if (otrasFirmas > 0 && (input.nombre !== cuenta.nombre || email !== cuenta.email)) {
    throw new Error(`${COMPARTIDA}: su nombre y su email no se editan desde una firma.`);
  }
  if (email !== cuenta.email) {
    if (cuenta.estado !== "Invitado") throw new Error("El email solo se corrige mientras la invitación está pendiente.");
    await exigirEmailLibre(email, usuarioId);
  }
  if (esAdminFirma !== membresia.esAdminFirma) {
    if (usuarioId === actor.id) throw new Error("No puedes cambiar tu propio nivel de administrador.");
    if (membresia.esAdminFirma && membresia.estado === "Activa" && cuenta.estado === "Activo") await exigirOtroAdministradorActivo(firmaContableId, usuarioId);
  }
  await validarAsignaciones(firmaContableId, input.empresas);

  const antesAsignaciones = await conFirma(firmaContableId, () =>
    db.select({ empresaId: usuarioEmpresa.empresaId, rol: usuarioEmpresa.rol }).from(usuarioEmpresa).where(eq(usuarioEmpresa.usuarioId, usuarioId)),
  );
  const antes = { nombre: cuenta.nombre, email: cuenta.email, esAdminFirma: membresia.esAdminFirma, empresas: antesAsignaciones };

  const filtroMembresia = and(eq(membresias.usuarioId, usuarioId), eq(membresias.firmaContableId, firmaContableId));
  await dbPlataforma.transaction(async (tx) => {
    await tx.update(cuentas).set({ nombre: input.nombre, email, updatedAt: new Date() }).where(eq(cuentas.id, usuarioId));
    await tx.update(membresias).set({ esAdminFirma, updatedAt: new Date() }).where(filtroMembresia);
  });
  try {
    await conFirma(firmaContableId, () =>
      db.transaction(async (tx) => {
        await tx.update(usuarios).set({ nombre: input.nombre, email, updatedAt: new Date() }).where(eq(usuarios.id, usuarioId));
        await tx.delete(usuarioEmpresa).where(eq(usuarioEmpresa.usuarioId, usuarioId));
        if (input.empresas.length > 0) {
          await tx.insert(usuarioEmpresa).values(input.empresas.map((a) => ({ usuarioId, empresaId: a.empresaId, rol: a.rol })));
        }
      }),
    );
  } catch (error) {
    await dbPlataforma.transaction(async (tx) => {
      await tx.update(cuentas).set({ nombre: cuenta.nombre, email: cuenta.email, updatedAt: new Date() }).where(eq(cuentas.id, usuarioId));
      await tx.update(membresias).set({ esAdminFirma: membresia.esAdminFirma, updatedAt: new Date() }).where(filtroMembresia);
    });
    throw error;
  }

  await auditarUsuario(firmaContableId, actor, {
    usuarioId, etiqueta: email, accion: "editar", antes, despues: { nombre: input.nombre, email, esAdminFirma, empresas: input.empresas },
  });
}

/** Historial de gestión de una cuenta en esta firma (invitación, cambios, suspensiones, resets), lo más reciente primero. */
export async function historialDeUsuario(usuarioId: string, firmaContableId: string, actor: ActorGestion) {
  await miembroDeFirma(firmaContableId, usuarioId, actor);
  return conFirma(firmaContableId, () =>
    db
      .select()
      .from(bitacoraAuditoria)
      .where(and(eq(bitacoraAuditoria.tablaAfectada, "usuarios"), eq(bitacoraAuditoria.registroId, usuarioId)))
      .orderBy(desc(bitacoraAuditoria.creadoEn))
      .limit(100),
  );
}
