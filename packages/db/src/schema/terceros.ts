import { boolean, integer, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, montoColumn, timestampsColumns } from "./columns.helpers";
import { tipoTerceroEnum } from "./enums";
import { categoriasContables } from "./categorias-contables";
import { empresas } from "./empresas";
import { impuestos } from "./impuestos";
import { metodosPago } from "./metodos-pago";
import { monedas } from "./monedas";
import { planCuentas } from "./plan-cuentas";
import { tercerosGrupos } from "./terceros-grupos";

/**
 * 3.6 — Maestro de socios de negocio por empresa (estilo OCRD de SAP B1).
 * `cuentaContableAsociadaId` es la cuenta "puente" agregada (ej. "Clientes Nacionales") —
 * no se crea una cuenta por RUT (ver 3.2). `codigo` (CardCode) lo genera el servidor a
 * partir de `series_numeracion`. Contactos, direcciones y cuentas bancarias son tablas
 * hijas. Los campos comerciales (`limiteCredito`, `bloqueado`, `condicionPagoDias`) se
 * guardan pero no se validan todavía (no hay módulo de documentos).
 */
export const terceros = pgTable(
  "terceros",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    codigo: text("codigo"),
    rut: text("rut").notNull(),
    razonSocial: text("razon_social").notNull(),
    tipoTercero: tipoTerceroEnum("tipo_tercero").notNull(),
    nombreFantasia: text("nombre_fantasia"),
    giro: text("giro"),
    email: text("email"),
    telefono: text("telefono"),
    sitioWeb: text("sitio_web"),
    direccion: text("direccion"),
    notas: text("notas"),
    grupoId: uuid("grupo_id").references(() => tercerosGrupos.id, { onDelete: "set null" }),
    monedaId: uuid("moneda_id").references(() => monedas.id, { onDelete: "set null" }),
    impuestoDefaultId: uuid("impuesto_default_id").references(() => impuestos.id, {
      onDelete: "set null",
    }),
    cuentaContableAsociadaId: uuid("cuenta_contable_asociada_id").references(
      () => planCuentas.id,
      { onDelete: "restrict" },
    ),
    categoriaContableDefaultId: uuid("categoria_contable_default_id").references(
      () => categoriasContables.id,
      { onDelete: "set null" },
    ),
    metodoPagoDefaultId: uuid("metodo_pago_default_id").references(() => metodosPago.id, {
      onDelete: "set null",
    }),
    condicionPagoDias: integer("condicion_pago_dias").notNull().default(0),
    limiteCredito: montoColumn("limite_credito").notNull().default("0"),
    retencionHonorariosPct: numeric("retencion_honorarios_pct", { precision: 5, scale: 2 }),
    esEmisorBoletaHonorarios: boolean("es_emisor_boleta_honorarios").notNull().default(false),
    esReceptorBoletaHonorarios: boolean("es_receptor_boleta_honorarios").notNull().default(false),
    pendienteCompletar: boolean("pendiente_completar").notNull().default(false),
    activo: boolean("activo").notNull().default(true),
    bloqueado: boolean("bloqueado").notNull().default(false),
    motivoBloqueo: text("motivo_bloqueo"),
    ...timestampsColumns,
  },
  (t) => [
    uniqueIndex("terceros_empresa_rut_unique").on(t.empresaId, t.rut),
    uniqueIndex("terceros_empresa_codigo_unique")
      .on(t.empresaId, t.codigo)
      .where(sql`${t.codigo} is not null`),
  ],
);
