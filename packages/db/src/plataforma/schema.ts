import { FIRMA_ESTADO, PLAN_CONTRATADO, TOKEN_TIPO, USUARIO_ESTADO } from "@erp/shared";
import { sql } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "../schema/columns.helpers";

/**
 * Base de plataforma: lo que existe por encima de las firmas. Cada firma contable tiene su
 * propia base (todo lo contable vive allí); aquí solo quedan las firmas y dónde está su base,
 * las credenciales de los usuarios (el login debe saber a qué firma pertenece un email antes
 * de abrir ninguna base de firma) y los tokens de invitación/reseteo.
 */

export const planContratadoEnum = pgEnum("plan_contratado", [...PLAN_CONTRATADO]);
export const firmaEstadoEnum = pgEnum("firma_estado", [...FIRMA_ESTADO]);
export const usuarioEstadoEnum = pgEnum("usuario_estado", [...USUARIO_ESTADO]);
export const tokenTipoEnum = pgEnum("token_tipo", [...TOKEN_TIPO]);
export const baseFirmaEstadoEnum = pgEnum("base_firma_estado", ["pendiente", "lista", "error"]);
/** `neon`: un proyecto Neon por firma (nube). `servidor`: una base en un Postgres propio (desarrollo, pruebas). */
/** Estado del acceso de una cuenta a una firma: la firma puede suspenderlo sin afectar a las demás. */
export const membresiaEstadoEnum = pgEnum("membresia_estado", ["Activa", "Suspendida"]);
export const baseProveedorEnum = pgEnum("base_proveedor", ["neon", "servidor"]);

export const firmasContables = pgTable(
  "firmas_contables",
  {
    id: idColumn(),
    rut: text("rut").notNull(),
    razonSocial: text("razon_social").notNull(),
    planContratado: planContratadoEnum("plan_contratado").notNull().default("Basico"),
    estado: firmaEstadoEnum("estado").notNull().default("Activa"),
    proveedor: baseProveedorEnum("proveedor").notNull(),
    /** Proyecto Neon de la firma (se borra a mano desde la consola de Neon). */
    neonProyectoId: text("neon_proyecto_id"),
    region: text("region"),
    /** Nombre de la base dentro de su servidor o proyecto. */
    baseDatos: text("base_datos"),
    /**
     * Conexiones de la firma cifradas con `FIRMAS_CONEXION_KEY` (AES-256-GCM): la de la app
     * (con pooler) y la directa para migraciones. Nula mientras la base no existe.
     */
    conexionCifrada: text("conexion_cifrada"),
    estadoBase: baseFirmaEstadoEnum("estado_base").notNull().default("pendiente"),
    /** Última migración aplicada a la base de la firma. */
    versionEsquema: text("version_esquema"),
    migradaEn: timestamp("migrada_en", { withTimezone: true }),
    errorMigracion: text("error_migracion"),
    ...timestampsColumns,
  },
  (t) => [unique("firmas_contables_rut_unique").on(t.rut)],
);

/**
 * Cuentas de usuario: una persona, un email, una contraseña. A qué firmas tiene acceso, y con qué
 * nivel, lo dicen sus membresías (`membresias_firma`); una misma cuenta puede trabajar en varias
 * firmas. La base de cada firma guarda un reflejo (`usuarios`: id, nombre, email) para sus
 * referencias y su tabla de roles por empresa.
 */
export const usuarios = pgTable(
  "usuarios",
  {
    id: idColumn(),
    nombre: text("nombre").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    estado: usuarioEstadoEnum("estado").notNull().default("Invitado"),
    esSuperAdmin: boolean("es_super_admin").notNull().default(false),
    ...timestampsColumns,
  },
  // La unicidad no distingue mayúsculas: `A@x.cl` y `a@x.cl` son la misma cuenta.
  (t) => [uniqueIndex("usuarios_email_lower_unique").on(sql`lower(${t.email})`)],
);

/** Acceso de una cuenta a una firma: si la administra y si está vigente. Un registro por (cuenta, firma). */
export const membresias = pgTable(
  "membresias_firma",
  {
    id: idColumn(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    firmaContableId: uuid("firma_contable_id")
      .notNull()
      .references(() => firmasContables.id, { onDelete: "restrict" }),
    esAdminFirma: boolean("es_admin_firma").notNull().default(false),
    estado: membresiaEstadoEnum("estado").notNull().default("Activa"),
    ...timestampsColumns,
  },
  (t) => [
    unique("membresias_firma_usuario_firma_unique").on(t.usuarioId, t.firmaContableId),
    index("membresias_firma_firma_idx").on(t.firmaContableId),
  ],
);

/**
 * Invitación y reseteo de contraseña (el link se muestra en pantalla para copiarlo). La columna
 * `token` guarda el hash SHA-256 del valor del link, nunca el valor: quien lea la tabla no puede usarlo.
 */
export const tokensAcceso = pgTable(
  "tokens_acceso",
  {
    id: idColumn(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    tipo: tokenTipoEnum("tipo").notNull(),
    token: text("token").notNull(),
    expiraEn: timestamp("expira_en", { withTimezone: true }).notNull(),
    usadoEn: timestamp("usado_en", { withTimezone: true }),
    ...timestampsColumns,
  },
  (t) => [unique("tokens_acceso_token_unique").on(t.token)],
);
