import { pgTable, text } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";

/**
 * Reflejo, en la base de la firma, de las cuentas de usuario de la plataforma (donde viven
 * credenciales, estado y permisos de firma). Existe para que auditoría, documentos y roles
 * por empresa referencien y muestren al usuario sin consultar otra base. Mismo `id`.
 */
export const usuarios = pgTable("usuarios", {
  id: idColumn(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull(),
  ...timestampsColumns,
});
