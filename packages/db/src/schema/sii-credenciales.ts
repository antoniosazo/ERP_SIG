import { date, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { idColumn, timestampsColumns } from "./columns.helpers";
import { siiAmbienteEnum, siiMetodoAuthEnum } from "./enums";
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
    metodoAuth: siiMetodoAuthEnum("metodo_auth").notNull().default("clave"),
    /** RUT de la persona dueña del certificado, cuando difiere del RUT de la empresa
     * (representante autorizado ante el SII). Se usa solo para el login por
     * Certificado Digital; el RCV siempre se pide para `rut` (la empresa). */
    rutTitularCertificado: text("rut_titular_certificado"),
    claveCifrada: text("clave_cifrada"),
    certificadoCifrado: text("certificado_cifrado"),
    certificadoPassCifrada: text("certificado_pass_cifrada"),
    ambiente: siiAmbienteEnum("ambiente").notNull().default("produccion"),
    certificadoVence: date("certificado_vence"),
    ultimaSyncPeriodo: text("ultima_sync_periodo"),
    ...timestampsColumns,
  },
  (t) => [uniqueIndex("sii_credenciales_empresa_unique").on(t.empresaId)],
);
