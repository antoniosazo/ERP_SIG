import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { idColumn } from "./columns.helpers";
import { auditoriaAccionEnum } from "./enums";
import { empresas } from "./empresas";
import { usuarios } from "./usuarios";

/**
 * 3.8 — Bitácora de auditoría. Tabla central poblada a nivel de aplicación (no triggers):
 * cada mutación de un maestro deja aquí quién, qué y el antes/después en JSON.
 * Filas inmutables — solo `creadoEn`. `usuarioNombre` y `etiqueta` son snapshots para
 * que el registro siga siendo legible aunque se borre el usuario o el registro.
 */
export const bitacoraAuditoria = pgTable(
  "bitacora_auditoria",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    usuarioNombre: text("usuario_nombre").notNull(),
    tablaAfectada: text("tabla_afectada").notNull(),
    registroId: uuid("registro_id").notNull(),
    etiqueta: text("etiqueta").notNull(),
    accion: auditoriaAccionEnum("accion").notNull(),
    valoresAnteriores: jsonb("valores_anteriores"),
    valoresNuevos: jsonb("valores_nuevos"),
    motivo: text("motivo"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bitacora_auditoria_empresa_creado_idx").on(t.empresaId, t.creadoEn),
    index("bitacora_auditoria_registro_idx").on(t.tablaAfectada, t.registroId),
  ],
);
