import { pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { rolEnum } from "./enums";
import { empresas } from "./empresas";
import { usuarios } from "./usuarios";

/** 3.5 — Relación N:N: a qué empresas cliente accede cada usuario y con qué rol en cada una. */
export const usuarioEmpresa = pgTable(
  "usuario_empresa",
  {
    id: idColumn(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    rol: rolEnum("rol").notNull(),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("usuario_empresa_usuario_empresa_unique").on(t.usuarioId, t.empresaId)],
);
