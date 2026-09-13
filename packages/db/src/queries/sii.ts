import { and, eq } from "drizzle-orm";
import { normalizarRut } from "@erp/shared";
import { db } from "../client";
import {
  categoriasContables,
  documentosCompra,
  documentosVenta,
  impuestos,
  siiCredenciales,
  siiImportaciones,
  terceros,
  tercerosGrupos,
  tiposDocumento,
} from "../schema";
import type { AuditoriaCtx } from "./auditoria";
import { crearTercero } from "./terceros";
import { crearDocumentoCompra, guardarDocumentoCompra } from "./documentos-compra";
import { crearDocumentoVenta, guardarDocumentoVenta } from "./documentos-venta";
import { resolverCuentaGeneral } from "./reglas-determinacion-cuenta";

// ── Credenciales ────────────────────────────────────────────────────────────

export type CredencialesSiiRow = typeof siiCredenciales.$inferSelect;

export async function obtenerCredencialesSii(empresaId: string): Promise<CredencialesSiiRow | null> {
  const [row] = await db
    .select()
    .from(siiCredenciales)
    .where(eq(siiCredenciales.empresaId, empresaId));
  return row ?? null;
}

/** Upsert de las credenciales. Los campos `*Cifrada` llegan ya cifrados desde la acción. */
export async function guardarCredencialesSii(
  empresaId: string,
  input: {
    rut: string;
    metodoAuth: "clave" | "certificado";
    rutTitularCertificado?: string | null;
    claveCifrada?: string | null;
    certificadoCifrado?: string | null;
    certificadoPassCifrada?: string | null;
    ambiente: "certificacion" | "produccion";
    certificadoVence?: string | null;
  },
) {
  const set = {
    rut: input.rut,
    metodoAuth: input.metodoAuth,
    rutTitularCertificado: input.rutTitularCertificado || null,
    ambiente: input.ambiente,
    certificadoVence: input.certificadoVence ?? null,
    // Solo se pisan los secretos que vienen (no borrar por omitir).
    ...(input.claveCifrada !== undefined ? { claveCifrada: input.claveCifrada } : {}),
    ...(input.certificadoCifrado !== undefined
      ? { certificadoCifrado: input.certificadoCifrado }
      : {}),
    ...(input.certificadoPassCifrada !== undefined
      ? { certificadoPassCifrada: input.certificadoPassCifrada }
      : {}),
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(siiCredenciales)
    .values({ empresaId, ...set })
    .onConflictDoUpdate({ target: siiCredenciales.empresaId, set })
    .returning();
  return row!;
}

// ── Importación del RCV ─────────────────────────────────────────────────────

/** Fila normalizada del RCV (misma forma que `packages/app/lib/sii/tipos.ts`). */
export type DocRcv = {
  rutContraparte: string;
  nombreContraparte?: string;
  tipoDte: number;
  folio: string;
  fechaEmision: string;
  fechaRecepcionSii?: string;
  montoExento: number;
  montoNeto: number;
  montoIva: number;
  montoTotal: number;
  montoIvaNoRecuperable?: number;
  estadoRcv?: string;
  trackId?: string;
};

export type ResumenImportacion = {
  creados: number;
  existentes: number;
  errores: number;
  detalle: { folio: string; rut: string; resultado: string }[];
};

const CLASE_POR_DTE: Record<number, { compra: string; venta: string }> = {
  33: { compra: "factura", venta: "Factura" },
  34: { compra: "factura", venta: "Factura" },
  46: { compra: "factura", venta: "Factura" },
  56: { compra: "nota_debito", venta: "Nota de Débito" },
  61: { compra: "nota_credito", venta: "Nota de Crédito" },
};

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function importarDocumentosRcv(
  empresaId: string,
  origen: "compra" | "venta",
  periodo: string,
  docs: DocRcv[],
  ctx?: AuditoriaCtx,
): Promise<ResumenImportacion> {
  const res: ResumenImportacion = { creados: 0, existentes: 0, errores: 0, detalle: [] };

  const tiposDoc = await db.select().from(tiposDocumento);
  const tipoDocPorSii = new Map(tiposDoc.map((t) => [t.codigoSii, t.id]));
  const imps = await db
    .select()
    .from(impuestos)
    .where(eq(impuestos.empresaId, empresaId));
  const ivaCompra = imps.find((i) => i.tipo === "IVA Crédito" && i.activo);
  const ivaVenta = imps.find((i) => i.tipo === "IVA Débito" && i.activo);

  const gastoGeneral = await resolverCuentaGeneral(db, empresaId, "compra", "gasto");
  const ingresoGeneral = await resolverCuentaGeneral(db, empresaId, "venta", "ingreso");

  for (const d of docs) {
    const rutNorm = normalizarRut(d.rutContraparte);
    try {
      const codSii = String(d.tipoDte);
      const tipoDocumentoId = tipoDocPorSii.get(codSii);
      const clase = CLASE_POR_DTE[d.tipoDte];
      if (!tipoDocumentoId || !clase) {
        throw new Error(`Tipo de DTE ${d.tipoDte} no está en el catálogo de documentos.`);
      }

      // Contraparte: buscar por RUT, o crear.
      let [contraparte] = await db
        .select()
        .from(terceros)
        .where(and(eq(terceros.empresaId, empresaId), eq(terceros.rut, rutNorm)));
      if (!contraparte) {
        contraparte = await crearTercero(
          empresaId,
          {
            rut: rutNorm,
            razonSocial: d.nombreContraparte || d.rutContraparte,
            tipoTercero: origen === "compra" ? "Proveedor" : "Cliente",
          },
          ctx,
        );
      }

      // Idempotencia por (empresa, tercero, tipoDoc, folio).
      const tabla = origen === "compra" ? documentosCompra : documentosVenta;
      const [existe] = await db
        .select({ id: tabla.id })
        .from(tabla)
        .where(
          and(
            eq(tabla.empresaId, empresaId),
            eq(tabla.terceroId, contraparte.id),
            eq(tabla.tipoDocumentoId, tipoDocumentoId),
            eq(tabla.folio, d.folio),
          ),
        );
      if (existe) {
        res.existentes++;
        res.detalle.push({ folio: d.folio, rut: rutNorm, resultado: "ya existía" });
        continue;
      }

      const neto = d.montoNeto + d.montoExento;
      const esExento = d.montoIva === 0;
      const fechaVenc = sumarDias(d.fechaEmision, contraparte.condicionPagoDias ?? 0);

      // Categoría contable: 1) de la contraparte, 2) de su grupo de socios, si tiene.
      let cuentaImput: string | null = null;
      let ivaRecuperable: "Total" | "Parcial" | "No Recuperable" | null = null;
      const categoriaId =
        contraparte.categoriaContableDefaultId ??
        (contraparte.grupoId
          ? (
              await db.select().from(tercerosGrupos).where(eq(tercerosGrupos.id, contraparte.grupoId))
            )[0]?.categoriaContableDefaultId
          : null);
      if (categoriaId) {
        const [cat] = await db.select().from(categoriasContables).where(eq(categoriasContables.id, categoriaId));
        if (origen === "compra") cuentaImput = cat?.cuentaGastoId ?? null;
        else cuentaImput = cat?.cuentaIngresoId ?? null;
        ivaRecuperable = (cat?.ivaRecuperableDefault as typeof ivaRecuperable) ?? null;
      }
      if ((d.montoIvaNoRecuperable ?? 0) > 0) ivaRecuperable = "No Recuperable";

      if (origen === "compra") {
        cuentaImput = cuentaImput ?? gastoGeneral;
        if (!cuentaImput) {
          throw new Error("Sin cuenta de gasto: define la regla GENERAL compra/gasto.");
        }
        const doc = await crearDocumentoCompra(
          empresaId,
          { docTipo: clase.compra as never, tipoDocumentoId, terceroId: contraparte.id },
          ctx,
        );
        const guardado = await guardarDocumentoCompra(
          doc.id,
          empresaId,
          {
            docTipo: clase.compra as never,
            terceroId: contraparte.id,
            tipoDocumentoId,
            folio: d.folio,
            fechaEmision: d.fechaEmision,
            fechaVencimiento: fechaVenc,
            fechaContabilizacion: d.fechaRecepcionSii || d.fechaEmision,
            monedaId: doc.monedaId,
            tipoCambio: 1,
            descuentoGlobalPct: 0,
            condicionPagoDias: contraparte.condicionPagoDias ?? undefined,
            lineas: [
              {
                cuentaImputacionId: cuentaImput,
                cantidad: 1,
                precioUnitario: neto,
                descuentoLineaPct: 0,
                esExento,
                impuestoId: esExento ? undefined : ivaCompra?.id,
                ivaRecuperable: ivaRecuperable ?? undefined,
              },
            ],
          },
          ctx,
        );
        await db
          .update(documentosCompra)
          .set({ estadoRcv: d.estadoRcv ?? null, siiTrackId: d.trackId ?? null })
          .where(eq(documentosCompra.id, guardado.id));
      } else {
        cuentaImput = cuentaImput ?? ingresoGeneral;
        if (!cuentaImput) {
          throw new Error("Sin cuenta de ingreso: define la regla GENERAL venta/ingreso.");
        }
        const doc = await crearDocumentoVenta(
          empresaId,
          { clase: clase.venta as never, tipoDocumentoId, terceroId: contraparte.id },
          ctx,
        );
        const guardado = await guardarDocumentoVenta(
          doc.id,
          empresaId,
          {
            terceroId: contraparte.id,
            tipoDocumentoId,
            folio: d.folio,
            fechaEmision: d.fechaEmision,
            fechaVencimiento: fechaVenc,
            fechaContabilizacion: d.fechaEmision,
            monedaId: doc.monedaId,
            tipoCambio: 1,
            descuentoGlobalPct: 0,
            lineas: [
              {
                cuentaIngresoId: cuentaImput,
                cantidad: 1,
                precioUnitario: neto,
                descuentoLineaPct: 0,
                esExento,
                impuestoId: esExento ? undefined : ivaVenta?.id,
              },
            ],
          } as never,
          ctx,
        );
        await db
          .update(documentosVenta)
          .set({ estadoRcv: d.estadoRcv ?? null })
          .where(eq(documentosVenta.id, guardado.id));
      }

      res.creados++;
      res.detalle.push({ folio: d.folio, rut: rutNorm, resultado: "creado (borrador)" });
    } catch (e) {
      res.errores++;
      res.detalle.push({
        folio: d.folio,
        rut: rutNorm,
        resultado: e instanceof Error ? e.message : "error desconocido",
      });
    }
  }

  await db.insert(siiImportaciones).values({
    empresaId,
    periodo,
    origen,
    creados: res.creados,
    existentes: res.existentes,
    errores: res.errores,
    detalle: res.detalle,
  });
  return res;
}
