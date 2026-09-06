import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { tokenTipoEnum } from "./enums";
import { usuarios } from "./usuarios";

/**
 * Tabla nueva, no está en los documentos de diseño originales — necesaria para el flujo
 * de invitación/reseteo de contraseña sin envío automático de email (el link se genera
 * y se muestra en pantalla para copiar). Un solo mecanismo para ambos casos.
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
