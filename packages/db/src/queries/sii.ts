import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { normalizarRut } from "@erp/shared";
import { db } from "../client";
import {
  categoriasContables,
  documentosCompra,
  documentosCompraLineas,
  documentosVenta,
  documentosVentaLineas,
  impuestos,
  siiCredenciales,
  siiDtesPendientes,
  planCuentas,
  siiImportaciones,
  terceros,
  tercerosGrupos,
  tiposDocumento,
} from "../schema";
import type { AuditoriaCtx } from "./auditoria";
import { crearTercero } from "./terceros";
import { contabilizarDocumentoCompra, crearDocumentoCompra, guardarDocumentoCompra } from "./documentos-compra";
import { contabilizarDocumentoVenta, crearDocumentoVenta, guardarDocumentoVenta } from "./documentos-venta";
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
    tipoFacturador: "SII Gratuito" | "Facturador comercial" | "No emite DTE";
    nombreFacturador?: string | null;
    metodoAuth: "clave" | "certificado";
    rutTitular?: string | null;
    claveCifrada?: string | null;
    certificadoCifrado?: string | null;
    certificadoPassCifrada?: string | null;
    ambiente: "certificacion" | "produccion";
    certificadoVence?: string | null;
  },
) {
  const set = {
    rut: input.rut,
    tipoFacturador: input.tipoFacturador,
    nombreFacturador:
      input.tipoFacturador === "Facturador comercial" ? input.nombreFacturador || null : null,
    metodoAuth: input.metodoAuth,
    rutTitular: input.rutTitular || null,
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

/** Línea de detalle de un DTE (viene del XML; el RCV no la trae). Montos netos, sin IVA. */
export type LineaDteSii = {
  glosa: string;
  cantidad: number;
  precioUnitario: number;
  esExento: boolean;
};

export type DocSii = DocRcv & { lineas?: LineaDteSii[] };

async function prepararEntornoSii(empresaId: string) {
  const tiposDoc = await db.select().from(tiposDocumento);
  const tipoDocPorSii = new Map(tiposDoc.map((t) => [t.codigoSii, t.id]));
  const imps = await db.select().from(impuestos).where(eq(impuestos.empresaId, empresaId));
  return {
    tipoDocPorSii,
    ivaCompra: imps.find((i) => i.tipo === "IVA Crédito" && i.activo),
    ivaVenta: imps.find((i) => i.tipo === "IVA Débito" && i.activo),
    gastoGeneral: await resolverCuentaGeneral(db, empresaId, "compra", "gasto"),
    ingresoGeneral: await resolverCuentaGeneral(db, empresaId, "venta", "ingreso"),
  };
}

type EntornoSii = Awaited<ReturnType<typeof prepararEntornoSii>>;

type ResultadoBorradorSii =
  | { resultado: "creado"; documentoId: string; advertencia?: string; contabilizado: boolean }
  | { resultado: "existe"; documentoId: string };

/**
 * Líneas del documento a partir del DTE: una por ítem del XML (solo descripción, como un
 * documento de tipo Servicio de SAP B1: no se crea ningún artículo) o, sin XML (RCV), una sola con el neto. Si el total del DTE supera neto + IVA
 * (ej. impuesto específico a los combustibles), la diferencia va como línea exenta de IVA:
 * no es recuperable y forma parte del costo, y así el documento cuadra con el DTE.
 */
function construirLineasSii(d: DocSii): LineaDteSii[] {
  const neto = d.montoNeto + d.montoExento;
  const esExento = d.montoIva === 0;
  const lineasXml = (d.lineas ?? []).filter((l) => l.cantidad > 0 && l.precioUnitario * l.cantidad > 0);
  const lineas: LineaDteSii[] = lineasXml.length
    ? lineasXml.map((l) => ({ ...l, esExento: esExento || l.esExento }))
    : [{ glosa: "", cantidad: 1, precioUnitario: neto, esExento }];
  const otrosImpuestos = Math.round((d.montoTotal || 0) - (neto + d.montoIva));
  if (lineasXml.length && otrosImpuestos > 1) {
    lineas.push({
      glosa: "Impuestos adicionales del DTE (ej. impuesto específico a los combustibles)",
      cantidad: 1,
      precioUnitario: otrosImpuestos,
      esExento: true,
    });
  }
  return lineas;
}

/** Descripción de la línea: el nombre del ítem y, si aporta, su descripción (sin cifras variables tras "|"). */
function descripcionItemSii(nombre: string, descripcion?: string): string {
  const desc = descripcion?.split("|")[0]?.trim();
  const generico = /^(detalle|item|ítem|producto|servicio|descripci[oó]n)$/i.test(nombre.trim());
  if (generico && desc) return desc;
  return [nombre, desc].filter(Boolean).join(" — ");
}

/** Fila de la bandeja → documento del SII con sus líneas del XML. */
function docSiiDeFila(f: DtePendienteRow): DocSii {
  const dte = f.datos as DteBandeja;
  return {
    rutContraparte: f.rutContraparte,
    nombreContraparte: f.razonSocialContraparte ?? undefined,
    tipoDte: f.tipoDte,
    folio: f.folio,
    fechaEmision: f.fechaEmision,
    montoExento: Number(f.montoExento),
    montoNeto: Number(f.montoNeto),
    montoIva: Number(f.montoIva),
    montoTotal: Number(f.montoTotal),
    lineas: dte.lineas
      .filter((l) => l.montoItem > 0)
      .map((l) => {
        const cantidad = l.cantidad && l.cantidad > 0 ? l.cantidad : 1;
        return {
          glosa: descripcionItemSii(l.nombre, l.descripcion),
          cantidad,
          precioUnitario: l.montoItem / cantidad,
          esExento: l.exento,
        };
      }),
  };
}

/**
 * Crea (o detecta que ya existe) el documento de compra/venta en borrador para un
 * DTE del SII. Con `d.lineas` (XML) genera una línea por ítem; sin ellas (RCV) genera
 * una sola línea con el neto total.
 */
async function crearBorradorSii(
  env: EntornoSii,
  empresaId: string,
  origen: "compra" | "venta",
  d: DocSii,
  ctx?: AuditoriaCtx,
): Promise<ResultadoBorradorSii> {
  const rutNorm = normalizarRut(d.rutContraparte);
  const tipoDocumentoId = env.tipoDocPorSii.get(String(d.tipoDte));
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
  if (existe) return { resultado: "existe", documentoId: existe.id };

  const neto = d.montoNeto + d.montoExento;
  const esExento = d.montoIva === 0;
  const fechaVenc = sumarDias(d.fechaEmision, contraparte.condicionPagoDias ?? 0);

  // Categoría contable: 1) de la contraparte, 2) de su grupo de socios, si tiene.
  let cuentaImput: string | null = null;
  let ivaRecuperable: "Total" | "Parcial" | "No Recuperable" | null = null;
  const categoriaId =
    contraparte.categoriaContableDefaultId ??
    (contraparte.grupoId
      ? (await db.select().from(tercerosGrupos).where(eq(tercerosGrupos.id, contraparte.grupoId)))[0]
          ?.categoriaContableDefaultId
      : null);
  if (categoriaId) {
    const [cat] = await db.select().from(categoriasContables).where(eq(categoriasContables.id, categoriaId));
    cuentaImput = origen === "compra" ? (cat?.cuentaGastoId ?? null) : (cat?.cuentaIngresoId ?? null);
    ivaRecuperable = (cat?.ivaRecuperableDefault as typeof ivaRecuperable) ?? null;
  }
  if ((d.montoIvaNoRecuperable ?? 0) > 0) ivaRecuperable = "No Recuperable";

  const lineas = construirLineasSii(d);
  const totalEsperado = d.montoTotal || neto + d.montoIva;

  let documentoId: string;
  let totalGuardado: number;
  if (origen === "compra") {
    cuentaImput = cuentaImput ?? env.gastoGeneral;
    if (!cuentaImput) throw new Error("Sin cuenta de gasto: define la regla GENERAL compra/gasto.");
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
        modalidad: d.lineas?.length ? "Servicio" : "Artículo",
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
        lineas: lineas.map((l) => ({
          glosa: l.glosa ? l.glosa.slice(0, 300) : undefined,
          cuentaImputacionId: cuentaImput!,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuentoLineaPct: 0,
          esExento: l.esExento,
          impuestoId: l.esExento ? undefined : env.ivaCompra?.id,
          ivaRecuperable: ivaRecuperable ?? undefined,
        })),
      },
      ctx,
    );
    await db
      .update(documentosCompra)
      .set({ estadoRcv: d.estadoRcv ?? null, siiTrackId: d.trackId ?? null })
      .where(eq(documentosCompra.id, guardado.id));
    documentoId = guardado.id;
    totalGuardado = Number(guardado.montoTotal);
  } else {
    cuentaImput = cuentaImput ?? env.ingresoGeneral;
    if (!cuentaImput) throw new Error("Sin cuenta de ingreso: define la regla GENERAL venta/ingreso.");
    const doc = await crearDocumentoVenta(
      empresaId,
      { clase: clase.venta as never, tipoDocumentoId, terceroId: contraparte.id },
      ctx,
    );
    const guardado = await guardarDocumentoVenta(
      doc.id,
      empresaId,
      {
        modalidad: d.lineas?.length ? "Servicio" : "Artículo",
        terceroId: contraparte.id,
        tipoDocumentoId,
        folio: d.folio,
        fechaEmision: d.fechaEmision,
        fechaVencimiento: fechaVenc,
        fechaContabilizacion: d.fechaEmision,
        monedaId: doc.monedaId,
        tipoCambio: 1,
        descuentoGlobalPct: 0,
        lineas: lineas.map((l) => ({
          glosa: l.glosa ? l.glosa.slice(0, 300) : undefined,
          cuentaIngresoId: cuentaImput!,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuentoLineaPct: 0,
          esExento: l.esExento,
          impuestoId: l.esExento ? undefined : env.ivaVenta?.id,
        })),
      } as never,
      ctx,
    );
    await db
      .update(documentosVenta)
      .set({ estadoRcv: d.estadoRcv ?? null })
      .where(eq(documentosVenta.id, guardado.id));
    documentoId = guardado.id;
    totalGuardado = Number(guardado.montoTotal);
  }

  // Las facturas se contabilizan al cargarse: no quedan en borrador. Si no se puede (período
  // bloqueado, cuenta sin configurar…) el documento recién creado se descarta y el motivo
  // queda en la bandeja, donde el DTE sigue pendiente para reintentar.
  const esFactura = origen === "compra" ? clase.compra === "factura" : clase.venta === "Factura";
  if (esFactura) {
    try {
      if (origen === "compra") await contabilizarDocumentoCompra(documentoId, empresaId, ctx);
      else await contabilizarDocumentoVenta(documentoId, empresaId, ctx);
    } catch (e) {
      await (origen === "compra"
        ? db.delete(documentosCompra).where(eq(documentosCompra.id, documentoId))
        : db.delete(documentosVenta).where(eq(documentosVenta.id, documentoId)));
      throw new Error(`No se pudo contabilizar: ${e instanceof Error ? e.message : "error desconocido"}`);
    }
  }

  const advertencia =
    Math.abs(totalGuardado - totalEsperado) > 1
      ? `El total calculado (${totalGuardado}) difiere del total del DTE (${totalEsperado}); revisa el borrador.`
      : undefined;
  return { resultado: "creado", documentoId, advertencia, contabilizado: esFactura };
}

export async function importarDocumentosRcv(
  empresaId: string,
  origen: "compra" | "venta",
  periodo: string,
  docs: DocRcv[],
  ctx?: AuditoriaCtx,
): Promise<ResumenImportacion> {
  const res: ResumenImportacion = { creados: 0, existentes: 0, errores: 0, detalle: [] };
  const env = await prepararEntornoSii(empresaId);

  for (const d of docs) {
    const rutNorm = normalizarRut(d.rutContraparte);
    try {
      const r = await crearBorradorSii(env, empresaId, origen, d, ctx);
      if (r.resultado === "existe") {
        res.existentes++;
        res.detalle.push({ folio: d.folio, rut: rutNorm, resultado: "ya existía" });
      } else {
        res.creados++;
        res.detalle.push({ folio: d.folio, rut: rutNorm, resultado: "creado (borrador)" });
      }
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

// ── Bandeja previa a la carga (XML del Sistema de Facturación Gratuita) ─────

/** DTE ya parseado del XML, en la forma que se guarda en la bandeja (`datos`). */
export type DteBandeja = {
  tipoDte: number;
  folio: string;
  fechaEmision: string;
  rutEmisor: string;
  razonSocialEmisor: string;
  rutReceptor: string;
  razonSocialReceptor: string;
  montoNeto: number;
  montoExento: number;
  montoIva: number;
  montoTotal: number;
  lineas: { nroLinea: number; nombre: string; descripcion?: string; cantidad?: number; precioUnitario?: number; montoItem: number; exento: boolean }[];
  referencias: { tipoDocRef: string; folioRef: string; fechaRef?: string; razonRef?: string }[];
};

/** Tipos que se cargan como documento (guías y otros quedan fuera de la bandeja). */
export const TIPOS_DTE_BANDEJA = new Set(Object.keys(CLASE_POR_DTE).map(Number));

export type ResumenBandeja = {
  nuevos: number;
  yaCargados: number;
  existentes: number;
  omitidos: number;
  /** Proveedores/clientes que no existían y se crearon al guardar. */
  tercerosCreados: number;
};

/**
 * Crea la contraparte (proveedor en compras, cliente en ventas) si no existe; si ya existe
 * no hace nada. El alta queda en el grupo por defecto (el primero cuya cuenta puente es de
 * tipo Proveedor/Cliente) y con la ficha "pendiente de completar", para que alguien revise
 * y le asigne categoría contable. Devuelve `true` si lo creó.
 */
async function asegurarContraparte(
  empresaId: string,
  origen: "compra" | "venta",
  rut: string,
  razonSocial: string,
  ctx?: AuditoriaCtx,
): Promise<boolean> {
  const [existe] = await db
    .select({ id: terceros.id })
    .from(terceros)
    .where(and(eq(terceros.empresaId, empresaId), eq(terceros.rut, rut)));
  if (existe) return false;

  const tipoTercero = origen === "compra" ? "Proveedor" : "Cliente";
  const [grupo] = await db
    .select({ id: tercerosGrupos.id })
    .from(tercerosGrupos)
    .innerJoin(planCuentas, eq(planCuentas.id, tercerosGrupos.cuentaContableAsociadaId))
    .where(and(eq(tercerosGrupos.empresaId, empresaId), eq(planCuentas.tipoCuenta, tipoTercero)))
    .orderBy(tercerosGrupos.codigo)
    .limit(1);

  const creado = await crearTercero(
    empresaId,
    { rut, razonSocial: razonSocial || rut, tipoTercero },
    ctx,
  );
  await db
    .update(terceros)
    .set({ grupoId: grupo?.id ?? null, pendienteCompletar: true, updatedAt: new Date() })
    .where(eq(terceros.id, creado.id));
  return true;
}

/** Crea las contrapartes que falten para los DTE que ya están en la bandeja (pendientes). */
export async function crearContrapartesDeBandeja(
  empresaId: string,
  ctx?: AuditoriaCtx,
): Promise<{ creados: number; errores: number }> {
  const filas = await db
    .select({
      origen: siiDtesPendientes.origen,
      rut: siiDtesPendientes.rutContraparte,
      razon: siiDtesPendientes.razonSocialContraparte,
    })
    .from(siiDtesPendientes)
    .where(and(eq(siiDtesPendientes.empresaId, empresaId), eq(siiDtesPendientes.estado, "pendiente")));
  const vistos = new Set<string>();
  let creados = 0;
  let errores = 0;
  for (const f of filas) {
    const clave = `${f.origen}:${f.rut}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    try {
      if (await asegurarContraparte(empresaId, f.origen as "compra" | "venta", f.rut, f.razon ?? "", ctx)) creados++;
    } catch {
      errores++;
    }
  }
  return { creados, errores };
}

/**
 * Guarda en la bandeja los DTE recién descargados. Idempotente: uno ya presente en la
 * bandeja (en cualquier estado) no se toca; uno que ya existe como documento se registra
 * como "cargado" para no volver a proponerlo.
 */
export async function guardarDtesEnBandeja(
  empresaId: string,
  origen: "compra" | "venta",
  dtes: DteBandeja[],
): Promise<ResumenBandeja> {
  const res: ResumenBandeja = { nuevos: 0, yaCargados: 0, existentes: 0, omitidos: 0, tercerosCreados: 0 };
  const env = await prepararEntornoSii(empresaId);

  for (const d of dtes) {
    if (!TIPOS_DTE_BANDEJA.has(d.tipoDte)) {
      res.omitidos++;
      continue;
    }
    const rut = normalizarRut(origen === "compra" ? d.rutEmisor : d.rutReceptor);
    const razon = origen === "compra" ? d.razonSocialEmisor : d.razonSocialReceptor;

    // La contraparte se asegura antes que el DTE: si falla (ej. sin serie de numeración) el
    // DTE igual entra a la bandeja, y `cargarDtesDeBandeja` la vuelve a crear al cargarlo.
    try {
      if (await asegurarContraparte(empresaId, origen, rut, razon)) res.tercerosCreados++;
    } catch {
      /* se reintenta al cargar */
    }

    // ¿Ya existe como documento? (mismo criterio de idempotencia que `crearBorradorSii`)
    let documentoId: string | null = null;
    const tipoDocumentoId = env.tipoDocPorSii.get(String(d.tipoDte));
    if (tipoDocumentoId) {
      const [tercero] = await db
        .select({ id: terceros.id })
        .from(terceros)
        .where(and(eq(terceros.empresaId, empresaId), eq(terceros.rut, rut)));
      if (tercero) {
        const tabla = origen === "compra" ? documentosCompra : documentosVenta;
        const [doc] = await db
          .select({ id: tabla.id })
          .from(tabla)
          .where(
            and(
              eq(tabla.empresaId, empresaId),
              eq(tabla.terceroId, tercero.id),
              eq(tabla.tipoDocumentoId, tipoDocumentoId),
              eq(tabla.folio, d.folio),
            ),
          );
        documentoId = doc?.id ?? null;
      }
    }

    const inserted = await db
      .insert(siiDtesPendientes)
      .values({
        empresaId,
        origen,
        tipoDte: d.tipoDte,
        folio: d.folio,
        rutContraparte: rut,
        razonSocialContraparte: razon || null,
        fechaEmision: d.fechaEmision,
        montoNeto: String(d.montoNeto),
        montoExento: String(d.montoExento),
        montoIva: String(d.montoIva),
        montoTotal: String(d.montoTotal),
        datos: d,
        estado: documentoId ? "cargado" : "pendiente",
        documentoId,
        resueltoEn: documentoId ? new Date() : null,
      })
      .onConflictDoNothing()
      .returning({ id: siiDtesPendientes.id });
    if (inserted.length === 0) res.existentes++;
    else if (documentoId) res.yaCargados++;
    else res.nuevos++;
  }
  return res;
}

export type DtePendienteRow = typeof siiDtesPendientes.$inferSelect;

export async function listarDtesBandeja(
  empresaId: string,
  origen: "compra" | "venta",
  estado: "pendiente" | "cargado" | "descartado" = "pendiente",
) {
  return db
    .select()
    .from(siiDtesPendientes)
    .where(
      and(
        eq(siiDtesPendientes.empresaId, empresaId),
        eq(siiDtesPendientes.origen, origen),
        eq(siiDtesPendientes.estado, estado),
      ),
    )
    .orderBy(desc(siiDtesPendientes.fechaEmision), desc(siiDtesPendientes.folio));
}

export async function contarDtesBandeja(empresaId: string) {
  const rows = await db
    .select({ origen: siiDtesPendientes.origen, n: sql<number>`count(*)::int` })
    .from(siiDtesPendientes)
    .where(and(eq(siiDtesPendientes.empresaId, empresaId), eq(siiDtesPendientes.estado, "pendiente")))
    .groupBy(siiDtesPendientes.origen);
  return {
    compra: rows.find((r) => r.origen === "compra")?.n ?? 0,
    venta: rows.find((r) => r.origen === "venta")?.n ?? 0,
  };
}

/**
 * Convierte DTE de la bandeja en documentos en borrador. Uno con error queda
 * "pendiente" con el motivo en `error`, para corregirlo (ej. falta la cuenta de gasto) y reintentar.
 */
export async function cargarDtesDeBandeja(
  empresaId: string,
  ids: string[],
  ctx?: AuditoriaCtx,
): Promise<{ cargados: number; errores: number; detalle: { id: string; folio: string; resultado: string }[] }> {
  const out = { cargados: 0, errores: 0, detalle: [] as { id: string; folio: string; resultado: string }[] };
  if (ids.length === 0) return out;
  const filas = await db
    .select()
    .from(siiDtesPendientes)
    .where(
      and(
        eq(siiDtesPendientes.empresaId, empresaId),
        eq(siiDtesPendientes.estado, "pendiente"),
        inArray(siiDtesPendientes.id, ids),
      ),
    );
  const env = await prepararEntornoSii(empresaId);

  for (const f of filas) {
    const origen = f.origen as "compra" | "venta";
    try {
      const r = await crearBorradorSii(env, empresaId, origen, docSiiDeFila(f), ctx);
      await db
        .update(siiDtesPendientes)
        .set({
          estado: "cargado",
          documentoId: r.documentoId,
          error: r.resultado === "creado" ? (r.advertencia ?? null) : null,
          resueltoEn: new Date(),
        })
        .where(eq(siiDtesPendientes.id, f.id));
      out.cargados++;
      out.detalle.push({
        id: f.id,
        folio: f.folio,
        resultado:
          r.resultado === "existe"
            ? "ya existía como documento"
            : (r.advertencia ?? (r.contabilizado ? "creado y contabilizado" : "creado (borrador)")),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error desconocido";
      await db.update(siiDtesPendientes).set({ error: msg }).where(eq(siiDtesPendientes.id, f.id));
      out.errores++;
      out.detalle.push({ id: f.id, folio: f.folio, resultado: msg });
    }
  }
  return out;
}

export async function cambiarEstadoDtesBandeja(
  empresaId: string,
  ids: string[],
  estado: "pendiente" | "descartado",
) {
  if (ids.length === 0) return;
  await db
    .update(siiDtesPendientes)
    .set({ estado, error: null, resueltoEn: estado === "descartado" ? new Date() : null })
    .where(
      and(
        eq(siiDtesPendientes.empresaId, empresaId),
        inArray(siiDtesPendientes.id, ids),
        // Un DTE ya cargado no se toca: su documento existe.
        inArray(siiDtesPendientes.estado, ["pendiente", "descartado"]),
      ),
    );
}

export async function registrarDescargaXml(empresaId: string, detalle: string) {
  await db
    .update(siiCredenciales)
    .set({ xmlUltimaDescargaEn: new Date(), xmlUltimaDescargaDetalle: detalle.slice(0, 1000) })
    .where(eq(siiCredenciales.empresaId, empresaId));
}

/** Empresas con credenciales del SII Gratuito completas: las que la descarga programada recorre. */
export async function listarEmpresasConXmlSii() {
  return db
    .select({
      empresaId: siiCredenciales.empresaId,
      rut: siiCredenciales.rut,
      metodoAuth: siiCredenciales.metodoAuth,
      tieneClave: sql<boolean>`${siiCredenciales.claveCifrada} is not null`,
      tieneCertificado: sql<boolean>`${siiCredenciales.certificadoCifrado} is not null`,
    })
    .from(siiCredenciales)
    .where(eq(siiCredenciales.tipoFacturador, "SII Gratuito"));
}

/**
 * Regenera las líneas de los borradores ya cargados desde la bandeja con la lógica actual
 * (productos de tipo Servicio, impuestos adicionales del DTE). Solo toca documentos que
 * siguen en borrador; conserva cabecera, cuenta de imputación e IVA recuperable de cada uno.
 */
export async function repararBorradoresDeBandeja(
  empresaId: string,
  ctx?: AuditoriaCtx,
  /** Solo estas filas de la bandeja; sin esto, todas las cargadas. */
  ids?: string[],
): Promise<{ reparados: number; omitidos: number; errores: number; detalle: string[] }> {
  const out = { reparados: 0, omitidos: 0, errores: 0, detalle: [] as string[] };
  const filas = await db
    .select()
    .from(siiDtesPendientes)
    .where(
      and(
        eq(siiDtesPendientes.empresaId, empresaId),
        eq(siiDtesPendientes.estado, "cargado"),
        ...(ids ? [inArray(siiDtesPendientes.id, ids)] : []),
      ),
    );
  const env = await prepararEntornoSii(empresaId);

  for (const f of filas) {
    if (!f.documentoId) continue;
    const d = docSiiDeFila(f);
    try {
      let totalGuardado: number;
      if (f.origen === "compra") {
        const [doc] = await db
          .select()
          .from(documentosCompra)
          .where(and(eq(documentosCompra.id, f.documentoId), eq(documentosCompra.empresaId, empresaId)));
        const [l0] = doc
          ? await db
              .select()
              .from(documentosCompraLineas)
              .where(eq(documentosCompraLineas.documentoCompraId, doc.id))
              .orderBy(asc(documentosCompraLineas.numeroLinea))
              .limit(1)
          : [];
        if (!doc || doc.estado !== "borrador" || !l0) {
          out.omitidos++;
          continue;
        }
        const lineas = construirLineasSii(d);
        const g = await guardarDocumentoCompra(
          doc.id,
          empresaId,
          {
            docTipo: doc.docTipo,
            modalidad: "Servicio",
            terceroId: doc.terceroId,
            tipoDocumentoId: doc.tipoDocumentoId,
            folio: doc.folio,
            fechaEmision: doc.fechaEmision,
            fechaVencimiento: doc.fechaVencimiento ?? doc.fechaEmision,
            fechaContabilizacion: doc.fechaContabilizacion ?? doc.fechaEmision,
            monedaId: doc.monedaId,
            tipoCambio: Number(doc.tipoCambio),
            descuentoGlobalPct: Number(doc.descuentoGlobalPct),
            condicionPagoDias: doc.condicionPagoDias ?? undefined,
            glosa: doc.glosa,
            lineas: lineas.map((l) => ({
              glosa: l.glosa ? l.glosa.slice(0, 300) : undefined,
                  cuentaImputacionId: l0.cuentaImputacionId,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              descuentoLineaPct: 0,
              esExento: l.esExento,
              impuestoId: l.esExento ? undefined : env.ivaCompra?.id,
              ivaRecuperable: l0.ivaRecuperable ?? undefined,
            })),
          },
          ctx,
        );
        totalGuardado = Number(g.montoTotal);
      } else {
        const [doc] = await db
          .select()
          .from(documentosVenta)
          .where(and(eq(documentosVenta.id, f.documentoId), eq(documentosVenta.empresaId, empresaId)));
        const [l0] = doc
          ? await db
              .select()
              .from(documentosVentaLineas)
              .where(eq(documentosVentaLineas.documentoVentaId, doc.id))
              .orderBy(asc(documentosVentaLineas.numeroLinea))
              .limit(1)
          : [];
        if (!doc || doc.estado !== "borrador" || !l0) {
          out.omitidos++;
          continue;
        }
        const lineas = construirLineasSii(d);
        const g = await guardarDocumentoVenta(
          doc.id,
          empresaId,
          {
            modalidad: "Servicio",
            terceroId: doc.terceroId,
            tipoDocumentoId: doc.tipoDocumentoId,
            folio: doc.folio,
            fechaEmision: doc.fechaEmision,
            fechaVencimiento: doc.fechaVencimiento ?? doc.fechaEmision,
            fechaContabilizacion: doc.fechaContabilizacion ?? doc.fechaEmision,
            monedaId: doc.monedaId,
            tipoCambio: Number(doc.tipoCambio),
            descuentoGlobalPct: Number(doc.descuentoGlobalPct),
            glosa: doc.glosa,
            lineas: lineas.map((l) => ({
              glosa: l.glosa ? l.glosa.slice(0, 300) : undefined,
                  cuentaIngresoId: l0.cuentaIngresoId,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              descuentoLineaPct: 0,
              esExento: l.esExento,
              impuestoId: l.esExento ? undefined : env.ivaVenta?.id,
            })),
          } as never,
          ctx,
        );
        totalGuardado = Number(g.montoTotal);
      }
      const dif = Math.abs(totalGuardado - d.montoTotal);
      await db
        .update(siiDtesPendientes)
        .set({
          error: dif > 1 ? `El total calculado (${totalGuardado}) difiere del total del DTE (${d.montoTotal}); revisa el borrador.` : null,
        })
        .where(eq(siiDtesPendientes.id, f.id));
      out.reparados++;
      if (dif > 1) out.detalle.push(`${f.folio}: total ${totalGuardado} vs DTE ${d.montoTotal}`);
    } catch (e) {
      out.errores++;
      out.detalle.push(`${f.folio}: ${e instanceof Error ? e.message : "error"}`);
    }
  }
  return out;
}

/** Contabiliza las facturas que quedaron en borrador (compra y venta) de una empresa. */
export async function contabilizarFacturasEnBorrador(
  empresaId: string,
  ctx?: AuditoriaCtx,
): Promise<{ contabilizadas: number; errores: number; detalle: string[] }> {
  const out = { contabilizadas: 0, errores: 0, detalle: [] as string[] };
  const compras = await db
    .select({ id: documentosCompra.id, folio: documentosCompra.folio })
    .from(documentosCompra)
    .where(
      and(
        eq(documentosCompra.empresaId, empresaId),
        eq(documentosCompra.docTipo, "factura"),
        eq(documentosCompra.estado, "borrador"),
      ),
    )
    .orderBy(asc(documentosCompra.fechaEmision), asc(documentosCompra.createdAt));
  const ventas = await db
    .select({ id: documentosVenta.id, folio: documentosVenta.folio })
    .from(documentosVenta)
    .where(
      and(
        eq(documentosVenta.empresaId, empresaId),
        eq(documentosVenta.clase, "Factura"),
        eq(documentosVenta.estado, "borrador"),
      ),
    )
    .orderBy(asc(documentosVenta.fechaEmision), asc(documentosVenta.createdAt));
  for (const [origen, docs] of [["compra", compras], ["venta", ventas]] as const) {
    for (const d of docs) {
      try {
        if (origen === "compra") await contabilizarDocumentoCompra(d.id, empresaId, ctx);
        else await contabilizarDocumentoVenta(d.id, empresaId, ctx);
        out.contabilizadas++;
      } catch (e) {
        out.errores++;
        out.detalle.push(`${origen} ${d.folio ?? d.id}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
  }
  return out;
}
