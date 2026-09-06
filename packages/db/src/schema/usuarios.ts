import { boolean, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { usuarioEstadoEnum } from "./enums";
import { firmasContables } from "./firmas-contables";

/**
 * 3.5 — Usuarios (staff de la firma contable). `passwordHash` queda null mientras el
 * usuario está en estado "Invitado" (ver módulo de Usuarios y Roles / tokens_acceso).
 * `mfaHabilitado` del ERD se omite: no hay MFA en esta fase.
 *
 * `esAdminFirma` es un flag a nivel de firma, distinto del `rol` por-empresa de
 * `usuario_empresa`: administrar usuarios y los datos de la propia firma (4.9-E) son
 * acciones de firma, no de una empresa cliente en particular — sin este flag no habría
 * forma de que el primer Administrador (sin empresas asignadas todavía) pudiera
 * gestionar nada. Descubierto al implementar el bootstrap; no estaba en el plan original.
 */
export const usuarios = pgTable(
  "usuarios",
  {
    id: idColumn(),
    firmaContableId: uuid("firma_contable_id")
      .notNull()
      .references(() => firmasContables.id, { onDelete: "restrict" }),
    nombre: text("nombre").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    estado: usuarioEstadoEnum("estado").notNull().default("Invitado"),
    esAdminFirma: boolean("es_admin_firma").notNull().default(false),
    ...timestampsColumns,
  },
  (t) => [unique("usuarios_email_unique").on(t.email)],
);
