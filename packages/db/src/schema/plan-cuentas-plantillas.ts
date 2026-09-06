import { pgTable, text, unique } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";

/**
 * Plantillas de plan de cuentas clonables al inicializar una empresa (4.9-A).
 * No está modelada como tabla propia en el diseño técnico original — se agrega aquí
 * (ver decisión de diseño 2 del plan) para que "clonar la plantilla" sea un mecanismo
 * concreto: una plantilla es simplemente un árbol de `plan_cuentas` con `empresaId = null`
 * y `plantillaId` apuntando a esta tabla.
 */
export const planCuentasPlantillas = pgTable(
  "plan_cuentas_plantillas",
  {
    id: idColumn(),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    descripcion: text("descripcion"),
    ...timestampsColumns,
  },
  (t) => [unique("plan_cuentas_plantillas_codigo_unique").on(t.codigo)],
);
