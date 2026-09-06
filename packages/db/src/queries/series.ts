import { DOCUMENTO_COMPRA_TIPO, type SerieAmbito, type TipoTercero } from "@erp/shared";
import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "../client";
import { seriesNumeracion } from "../schema";

/** Prefijos por tipo de socio de negocio (CardCode estilo SAP B1). */
const PREFIJO_TERCERO: Record<TipoTercero, string> = {
  Cliente: "CL-",
  Proveedor: "PR-",
  "Prestador Honorarios": "HON-",
  Otro: "OT-",
};

/**
 * Toma el siguiente correlativo de una serie e incrementa `proximo`. Debe llamarse
 * dentro de una transacción; usa `FOR UPDATE` para serializar altas concurrentes.
 */
export async function siguienteCodigo(
  tx: Tx,
  empresaId: string,
  ambito: SerieAmbito,
  clave: string,
): Promise<string> {
  const [serie] = await tx
    .select()
    .from(seriesNumeracion)
    .where(
      and(
        eq(seriesNumeracion.empresaId, empresaId),
        eq(seriesNumeracion.ambito, ambito),
        eq(seriesNumeracion.clave, clave),
      ),
    )
    .for("update");
  if (!serie) throw new Error(`No hay serie de numeración para ${ambito}/${clave}`);

  const codigo = `${serie.prefijo}${String(serie.proximo).padStart(serie.digitos, "0")}`;
  await tx
    .update(seriesNumeracion)
    .set({ proximo: sql`${seriesNumeracion.proximo} + 1`, updatedAt: new Date() })
    .where(eq(seriesNumeracion.id, serie.id));
  return codigo;
}

/** Crea la serie de correlativo interno de documentos de venta (idempotente). */
export async function sembrarSeriesVenta(tx: Tx, empresaId: string): Promise<void> {
  await tx
    .insert(seriesNumeracion)
    .values({
      empresaId,
      ambito: "venta" as const,
      clave: "documento",
      prefijo: "V-",
      proximo: 1,
      digitos: 6,
    })
    .onConflictDoNothing({
      target: [seriesNumeracion.empresaId, seriesNumeracion.ambito, seriesNumeracion.clave],
    });
}

/** Prefijos de serie por tipo de documento de compra. */
const PREFIJO_COMPRA: Record<(typeof DOCUMENTO_COMPRA_TIPO)[number], string> = {
  pedido: "OC-",
  entrada_mercaderia: "EM-",
  factura: "FC-",
  nota_credito: "NCC-",
  nota_debito: "NDC-",
};

/** Crea las series de numeración de los documentos de compra (una por tipo, idempotente). */
export async function sembrarSeriesCompra(tx: Tx, empresaId: string): Promise<void> {
  await tx
    .insert(seriesNumeracion)
    .values(
      DOCUMENTO_COMPRA_TIPO.map((docTipo) => ({
        empresaId,
        ambito: "compra" as const,
        clave: docTipo,
        prefijo: PREFIJO_COMPRA[docTipo],
        proximo: 1,
        digitos: 5,
      })),
    )
    .onConflictDoNothing({
      target: [seriesNumeracion.empresaId, seriesNumeracion.ambito, seriesNumeracion.clave],
    });
}

/** Crea la serie de código automático de productos (idempotente). */
export async function sembrarSeriesProducto(tx: Tx, empresaId: string): Promise<void> {
  await tx
    .insert(seriesNumeracion)
    .values({
      empresaId,
      ambito: "producto" as const,
      clave: "codigo",
      prefijo: "ART-",
      proximo: 1,
      digitos: 5,
    })
    .onConflictDoNothing({
      target: [seriesNumeracion.empresaId, seriesNumeracion.ambito, seriesNumeracion.clave],
    });
}

/** Crea las 4 series de CardCode de terceros para una empresa (idempotente). */
export async function sembrarSeriesTercero(tx: Tx, empresaId: string): Promise<void> {
  await tx
    .insert(seriesNumeracion)
    .values(
      (Object.entries(PREFIJO_TERCERO) as [TipoTercero, string][]).map(([clave, prefijo]) => ({
        empresaId,
        ambito: "tercero" as const,
        clave,
        prefijo,
        proximo: 1,
        digitos: 5,
      })),
    )
    .onConflictDoNothing({
      target: [seriesNumeracion.empresaId, seriesNumeracion.ambito, seriesNumeracion.clave],
    });
}
