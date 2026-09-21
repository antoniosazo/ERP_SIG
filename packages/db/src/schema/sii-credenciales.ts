import { date, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { siiAmbienteEnum, siiMetodoAuthEnum, tipoFacturadorEnum } from "./enums";
import { empresas } from "./empresas";

/**
 * Credenciales del SII por empresa para descargar el RCV y hacer el acuse de recibo.
 * `claveCifrada`, `certificadoCifrado` y `certificadoPassCifrada` son AES‑256‑GCM
 * (`packages/app/lib/sii/cripto.ts`); se descifran solo en memoria en el server action.
 */
export const siiCredenciales = pgTable(
  "sii_credenciales",
  {
    id: idColumn(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    rut: text("rut").notNull(),
    /** Con qué emite/recibe DTE el cliente — determina qué vía de importación tiene
     * sentido ofrecerle (ej. subir XML de "Historial de DTE" solo aplica a SII Gratuito). */
    tipoFacturador: tipoFacturadorEnum("tipo_facturador").notNull().default("SII Gratuito"),
    /** Nombre del proveedor comercial (Nubox, Bsale, Defontana, etc.), solo cuando
     * `tipoFacturador = "Facturador comercial"`. Texto libre: el mercado tiene demasiados
     * proveedores para mantener una lista cerrada. */
    nombreFacturador: text("nombre_facturador"),
    metodoAuth: siiMetodoAuthEnum("metodo_auth").notNull().default("clave"),
    /** RUT de la persona con la que se hace login ante el SII, cuando difiere del RUT
     * de la empresa (representante/mandatario autorizado — ej. el contador con su
     * propia Clave Tributaria o su propio certificado, operando "a nombre de"). Aplica
     * a ambos métodos de autenticación; el RCV siempre se pide para `rut` (la empresa). */
    rutTitular: text("rut_titular"),
    claveCifrada: text("clave_cifrada"),
    certificadoCifrado: text("certificado_cifrado"),
    certificadoPassCifrada: text("certificado_pass_cifrada"),
    ambiente: siiAmbienteEnum("ambiente").notNull().default("produccion"),
    certificadoVence: date("certificado_vence"),
    ultimaSyncPeriodo: text("ultima_sync_periodo"),
    /** Última corrida (programada o manual) de la descarga de XML a la bandeja. */
    xmlUltimaDescargaEn: timestamp("xml_ultima_descarga_en", { withTimezone: true }),
    xmlUltimaDescargaDetalle: text("xml_ultima_descarga_detalle"),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("sii_credenciales_empresa_unique").on(t.empresaId)],
);
