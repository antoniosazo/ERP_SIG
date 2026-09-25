import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { timestampsColumns } from "./columns.helpers";
import { libroContableEnum } from "./enums";
import { activosFijosClases } from "./activos-fijos-clases";
import { planCuentas } from "./plan-cuentas";

/**
 * Cuentas contables de una clase de activo, por libro (Tributario/IFRS) — equivalente a
 * AF_DET_CUENTAS de la especificación. Si una clase no tiene fila para un libro dado, el
 * motor cae al fallback general de `reglas_determinacion_cuenta` (contexto "general",
 * roles activo_fijo / depreciacion_acumulada / gasto_depreciacion /
 * cuenta_compensacion_capitalizacion).
 */
export const activosFijosClasesCuentas = pgTable(
  "activos_fijos_clases_cuentas",
  {
    claseId: uuid("clase_id")
      .notNull()
      .references(() => activosFijosClases.id, { onDelete: "cascade" }),
    libro: libroContableEnum("libro").notNull(),
    ctaActivo: uuid("cta_activo").references(() => planCuentas.id, { onDelete: "restrict" }),
    ctaDepAcumulada: uuid("cta_dep_acumulada").references(() => planCuentas.id, { onDelete: "restrict" }),
    ctaGastoDep: uuid("cta_gasto_dep").references(() => planCuentas.id, { onDelete: "restrict" }),
    ctaCompensacionCapitalizacion: uuid("cta_compensacion_capitalizacion").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    ctaUtilidadBaja: uuid("cta_utilidad_baja").references(() => planCuentas.id, { onDelete: "restrict" }),
    ctaPerdidaBaja: uuid("cta_perdida_baja").references(() => planCuentas.id, { onDelete: "restrict" }),
    ctaValorLibroBaja: uuid("cta_valor_libro_baja").references(() => planCuentas.id, { onDelete: "restrict" }),
    ...timestampsColumns,
  },
  (t) => [primaryKey({ columns: [t.claseId, t.libro] })],
);
