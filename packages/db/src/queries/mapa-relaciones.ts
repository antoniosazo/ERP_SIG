import { and, eq, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { alias, type PgColumn, type PgTable } from "drizzle-orm/pg-core";
import { db } from "../client";
import {
  activosFijos,
  activosFijosDocumentos,
  activosFijosDocumentosLineas,
  asientosContables,
  cheques,
  cierresEjercicio,
  depositos,
  depositosCheques,
  documentosCompra,
  documentosCompraLineas,
  documentosVenta,
  pagos,
  pagosDocumentos,
  terceros,
} from "../schema";

/**
 * Mapa de relaciones (estilo "Relationship Map" de SAP B1): cómo se encadenan los documentos.
 * No hay tabla propia: se arma al consultar con los vínculos que ya existen — líneas base
 * (`documentoBaseLineaId`), referencias de NC/ND, aplicaciones de pago, cheques, depósitos,
 * asientos (y sus reversas) y activos fijos. Todo se acota a `empresaId`.
 */

export const TABLAS_MAPA = [
  "documentos_compra",
  "documentos_venta",
  "pagos",
  "cheques",
  "depositos",
  "asientos_contables",
  "activos_fijos_documentos",
  "activos_fijos",
  "cierres_ejercicio",
] as const;
export type TablaMapa = (typeof TABLAS_MAPA)[number];

export type RefMapa = { tabla: TablaMapa; id: string };

export type TipoRelacion =
  | "base"
  | "corrige"
  | "pago"
  | "cheque"
  | "deposito"
  | "protesto"
  | "asiento"
  | "reversa"
  | "activo"
  | "movimiento";

export type NodoMapa = {
  clave: string;
  tabla: TablaMapa;
  id: string;
  tipo: string;
  numero: string;
  estado: string | null;
  fecha: string | null;
  monto: string | null;
  pagoTipo: string | null;
  anio: number | null;
  raiz: boolean;
};

export type AristaMapa = { desde: string; hasta: string; tipo: TipoRelacion; detalle: string | null };

export type SocioMapa = { id: string; rut: string; razonSocial: string };

export type MapaRelaciones = {
  raiz: string;
  /** Socio de negocios del documento (cliente o proveedor), si lo tiene. */
  socio: SocioMapa | null;
  nodos: NodoMapa[];
  aristas: AristaMapa[];
  truncado: boolean;
};

const MAX_NODOS = 80;
const MAX_NIVELES = 8;
const MAX_ACTIVOS_POR_DOCUMENTO = 25;
/** Documentos de periodo que tocan a todos los activos: no se recorren desde un activo. */
const TIPOS_AF_MASIVOS = ["DEP", "DEP_MAN", "CM"];

export const claveMapa = (tabla: TablaMapa, id: string) => `${tabla}:${id}`;
const refDeClave = (clave: string): RefMapa => {
  const i = clave.indexOf(":");
  return { tabla: clave.slice(0, i) as TablaMapa, id: clave.slice(i + 1) };
};

type Arista = AristaMapa;
const arista = (
  desde: RefMapa,
  hasta: RefMapa,
  tipo: TipoRelacion,
  detalle: string | null = null,
): Arista => ({ desde: claveMapa(desde.tabla, desde.id), hasta: claveMapa(hasta.tabla, hasta.id), tipo, detalle });

const pesos = (v: string | number | null) => Number(v ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 2 });
const cant = (v: string | number | null) => Number(v ?? 0).toLocaleString("es-CL", { maximumFractionDigits: 4 });

type Frontera = Map<TablaMapa, string[]>;
const ids = (f: Frontera, t: TablaMapa) => f.get(t) ?? [];
const algunoDe = (condiciones: (SQL | undefined)[]) => {
  const reales = condiciones.filter((c): c is SQL => !!c);
  return reales.length ? or(...reales) : undefined;
};
const en = (col: PgColumn, valores: string[]) => (valores.length ? inArray(col, valores) : undefined);

type ConAsiento = { id: PgColumn; empresaId: PgColumn; asientoId: PgColumn; asientoReversaId: PgColumn };

/** Vínculos de un conjunto de registros (la "frontera") con todo lo que tocan, en ambos sentidos. */
async function expandir(empresaId: string, f: Frontera): Promise<Arista[]> {
  const out: Arista[] = [];
  const compras = ids(f, "documentos_compra");
  const ventas = ids(f, "documentos_venta");
  const listaPagos = ids(f, "pagos");
  const listaCheques = ids(f, "cheques");
  const listaDepositos = ids(f, "depositos");
  const asientos = ids(f, "asientos_contables");
  const docsAf = ids(f, "activos_fijos_documentos");
  const activos = ids(f, "activos_fijos");
  const cierres = ids(f, "cierres_ejercicio");
  const consultas: Promise<void>[] = [];

  if (compras.length) {
    consultas.push(
      (async () => {
        // Trazabilidad por línea (verdad del flujo OC → entrada → factura; admite N:M).
        const base = alias(documentosCompraLineas, "linea_base");
        const docBase = alias(documentosCompra, "doc_base");
        const docDestino = alias(documentosCompra, "doc_destino");
        const porLinea = await db
          .select({
            origen: base.documentoCompraId,
            destino: documentosCompraLineas.documentoCompraId,
            cantidad: sql<string>`sum(${documentosCompraLineas.cantidad})`,
            lineas: sql<number>`count(*)::int`,
          })
          .from(documentosCompraLineas)
          .innerJoin(base, eq(base.id, documentosCompraLineas.documentoBaseLineaId))
          .innerJoin(
            docDestino,
            and(eq(docDestino.id, documentosCompraLineas.documentoCompraId), eq(docDestino.empresaId, empresaId)),
          )
          .innerJoin(docBase, and(eq(docBase.id, base.documentoCompraId), eq(docBase.empresaId, empresaId)))
          .where(or(inArray(documentosCompraLineas.documentoCompraId, compras), inArray(base.documentoCompraId, compras)))
          .groupBy(base.documentoCompraId, documentosCompraLineas.documentoCompraId);
        const vistos = new Set<string>();
        for (const r of porLinea) {
          vistos.add(`${r.origen}>${r.destino}`);
          out.push(
            arista(
              { tabla: "documentos_compra", id: r.origen },
              { tabla: "documentos_compra", id: r.destino },
              "base",
              `${r.lineas} línea(s) · ${cant(r.cantidad)} un.`,
            ),
          );
        }
        // Referencia de cabecera: NC/ND → factura que corrigen, y enlaces sin líneas (p. ej. SII).
        const cab = await db
          .select({ id: documentosCompra.id, base: documentosCompra.documentoBaseId, docTipo: documentosCompra.docTipo })
          .from(documentosCompra)
          .where(
            and(
              eq(documentosCompra.empresaId, empresaId),
              isNotNull(documentosCompra.documentoBaseId),
              or(inArray(documentosCompra.id, compras), inArray(documentosCompra.documentoBaseId, compras)),
            ),
          );
        for (const r of cab) {
          if (!r.base) continue;
          const corrige = r.docTipo === "nota_credito" || r.docTipo === "nota_debito";
          if (!corrige && vistos.has(`${r.base}>${r.id}`)) continue;
          out.push(
            arista(
              { tabla: "documentos_compra", id: r.base },
              { tabla: "documentos_compra", id: r.id },
              corrige ? "corrige" : "base",
            ),
          );
        }
      })(),
    );
  }

  if (ventas.length) {
    consultas.push(
      (async () => {
        const filas = await db
          .select({ id: documentosVenta.id, ref: documentosVenta.documentoReferenciaId })
          .from(documentosVenta)
          .where(
            and(
              eq(documentosVenta.empresaId, empresaId),
              isNotNull(documentosVenta.documentoReferenciaId),
              or(inArray(documentosVenta.id, ventas), inArray(documentosVenta.documentoReferenciaId, ventas)),
            ),
          );
        for (const r of filas) {
          if (r.ref) {
            out.push(arista({ tabla: "documentos_venta", id: r.ref }, { tabla: "documentos_venta", id: r.id }, "corrige"));
          }
        }
      })(),
    );
  }

  const condPagos = algunoDe([
    en(pagosDocumentos.pagoId, listaPagos),
    en(pagosDocumentos.documentoCompraId, compras),
    en(pagosDocumentos.documentoVentaId, ventas),
  ]);
  if (condPagos) {
    consultas.push(
      (async () => {
        const filas = await db
          .select({
            pagoId: pagosDocumentos.pagoId,
            compraId: pagosDocumentos.documentoCompraId,
            ventaId: pagosDocumentos.documentoVentaId,
            monto: sql<string>`sum(${pagosDocumentos.montoAplicado})`,
          })
          .from(pagosDocumentos)
          .innerJoin(pagos, and(eq(pagos.id, pagosDocumentos.pagoId), eq(pagos.empresaId, empresaId)))
          .where(condPagos)
          .groupBy(pagosDocumentos.pagoId, pagosDocumentos.documentoCompraId, pagosDocumentos.documentoVentaId);
        for (const r of filas) {
          const doc: RefMapa | null = r.compraId
            ? { tabla: "documentos_compra", id: r.compraId }
            : r.ventaId
              ? { tabla: "documentos_venta", id: r.ventaId }
              : null;
          if (doc) out.push(arista(doc, { tabla: "pagos", id: r.pagoId }, "pago", `$${pesos(r.monto)} aplicado`));
        }
      })(),
    );
  }

  const condCheques = algunoDe([en(cheques.pagoId, listaPagos), en(cheques.id, listaCheques), en(cheques.asientoProtestoId, asientos)]);
  if (condCheques) {
    consultas.push(
      (async () => {
        const filas = await db
          .select({ id: cheques.id, pagoId: cheques.pagoId, protesto: cheques.asientoProtestoId })
          .from(cheques)
          .where(and(eq(cheques.empresaId, empresaId), condCheques));
        for (const r of filas) {
          out.push(arista({ tabla: "pagos", id: r.pagoId }, { tabla: "cheques", id: r.id }, "cheque"));
          if (r.protesto) {
            out.push(arista({ tabla: "cheques", id: r.id }, { tabla: "asientos_contables", id: r.protesto }, "protesto"));
          }
        }
      })(),
    );
  }

  const condDepositos = algunoDe([en(depositosCheques.chequeId, listaCheques), en(depositosCheques.depositoId, listaDepositos)]);
  if (condDepositos) {
    consultas.push(
      (async () => {
        const filas = await db
          .select({ chequeId: depositosCheques.chequeId, depositoId: depositosCheques.depositoId })
          .from(depositosCheques)
          .innerJoin(depositos, and(eq(depositos.id, depositosCheques.depositoId), eq(depositos.empresaId, empresaId)))
          .where(condDepositos);
        for (const r of filas) {
          out.push(arista({ tabla: "cheques", id: r.chequeId }, { tabla: "depositos", id: r.depositoId }, "deposito"));
        }
      })(),
    );
  }

  const conAsiento: [TablaMapa, ConAsiento, string[]][] = [
    ["documentos_compra", documentosCompra, compras],
    ["documentos_venta", documentosVenta, ventas],
    ["pagos", pagos, listaPagos],
    ["depositos", depositos, listaDepositos],
    ["activos_fijos_documentos", activosFijosDocumentos, docsAf],
    ["cierres_ejercicio", cierresEjercicio, cierres],
  ];
  for (const [tabla, t, propios] of conAsiento) {
    const cond = algunoDe([en(t.id, propios), en(t.asientoId, asientos), en(t.asientoReversaId, asientos)]);
    if (!cond) continue;
    consultas.push(
      (async () => {
        const filas = (await db
          .select({ id: t.id, asiento: t.asientoId, reversa: t.asientoReversaId })
          .from(t as unknown as PgTable)
          .where(and(eq(t.empresaId, empresaId), cond))) as { id: string; asiento: string | null; reversa: string | null }[];
        for (const r of filas) {
          if (r.asiento) out.push(arista({ tabla, id: r.id }, { tabla: "asientos_contables", id: r.asiento }, "asiento"));
          if (r.reversa) out.push(arista({ tabla, id: r.id }, { tabla: "asientos_contables", id: r.reversa }, "reversa"));
        }
      })(),
    );
  }

  if (asientos.length) {
    consultas.push(
      (async () => {
        // Reversa de un asiento manual: apunta al original por origen polimórfico.
        const filas = await db
          .select({ id: asientosContables.id, origen: asientosContables.documentoOrigenId })
          .from(asientosContables)
          .where(
            and(
              eq(asientosContables.empresaId, empresaId),
              eq(asientosContables.documentoOrigenTabla, "asientos_contables"),
              isNotNull(asientosContables.documentoOrigenId),
              or(inArray(asientosContables.id, asientos), inArray(asientosContables.documentoOrigenId, asientos)),
            ),
          );
        for (const r of filas) {
          if (r.origen) {
            out.push(arista({ tabla: "asientos_contables", id: r.origen }, { tabla: "asientos_contables", id: r.id }, "reversa"));
          }
        }
      })(),
    );
  }

  const condActivos = algunoDe([
    en(activosFijos.id, activos),
    compras.length ? and(eq(activosFijos.documentoOrigenTabla, "documentos_compra"), inArray(activosFijos.documentoOrigenId, compras)) : undefined,
  ]);
  if (condActivos) {
    consultas.push(
      (async () => {
        const filas = await db
          .select({ id: activosFijos.id, tabla: activosFijos.documentoOrigenTabla, origen: activosFijos.documentoOrigenId })
          .from(activosFijos)
          .where(and(eq(activosFijos.empresaId, empresaId), isNotNull(activosFijos.documentoOrigenId), condActivos));
        for (const r of filas) {
          if (r.origen && r.tabla === "documentos_compra") {
            out.push(arista({ tabla: "documentos_compra", id: r.origen }, { tabla: "activos_fijos", id: r.id }, "activo"));
          }
        }
      })(),
    );
  }

  const condLineasAf = algunoDe([en(activosFijosDocumentosLineas.documentoId, docsAf), en(activosFijosDocumentosLineas.activoId, activos)]);
  if (condLineasAf) {
    consultas.push(
      (async () => {
        const filas = await db
          .selectDistinct({
            documentoId: activosFijosDocumentosLineas.documentoId,
            activoId: activosFijosDocumentosLineas.activoId,
            tipoDoc: activosFijosDocumentos.tipoDoc,
          })
          .from(activosFijosDocumentosLineas)
          .innerJoin(
            activosFijosDocumentos,
            and(eq(activosFijosDocumentos.id, activosFijosDocumentosLineas.documentoId), eq(activosFijosDocumentos.empresaId, empresaId)),
          )
          .where(condLineasAf);
        const porDocumento = new Map<string, number>();
        for (const r of filas) {
          const desdeDoc = docsAf.includes(r.documentoId);
          if (!desdeDoc && TIPOS_AF_MASIVOS.includes(r.tipoDoc)) continue;
          if (desdeDoc) {
            const n = (porDocumento.get(r.documentoId) ?? 0) + 1;
            porDocumento.set(r.documentoId, n);
            if (n > MAX_ACTIVOS_POR_DOCUMENTO) continue;
          }
          out.push(
            arista({ tabla: "activos_fijos", id: r.activoId }, { tabla: "activos_fijos_documentos", id: r.documentoId }, "movimiento"),
          );
        }
      })(),
    );
  }

  await Promise.all(consultas);
  return out;
}

const TIPO_COMPRA: Record<string, string> = {
  pedido: "Orden de compra",
  entrada_mercaderia: "Entrada de mercadería",
  factura: "Factura de compra",
  nota_credito: "Nota de crédito (compra)",
  nota_debito: "Nota de débito (compra)",
};
const TIPO_VENTA: Record<string, string> = {
  Factura: "Factura de venta",
  "Nota de Crédito": "Nota de crédito (venta)",
  "Nota de Débito": "Nota de débito (venta)",
};

/** Etiquetas de los nodos; descarta los que no pertenecen a la empresa. */
async function cargarNodos(empresaId: string, f: Frontera, raiz: string): Promise<Map<string, NodoMapa>> {
  const nodos = new Map<string, NodoMapa>();
  const poner = (tabla: TablaMapa, id: string, n: Omit<NodoMapa, "clave" | "tabla" | "id" | "raiz" | "pagoTipo" | "anio"> & { pagoTipo?: string | null; anio?: number | null }) => {
    const clave = claveMapa(tabla, id);
    nodos.set(clave, { clave, tabla, id, raiz: clave === raiz, pagoTipo: null, anio: null, ...n });
  };
  const trabajos: Promise<void>[] = [];
  const de = (t: TablaMapa) => ids(f, t);

  if (de("documentos_compra").length) {
    trabajos.push(
      (async () => {
        const filas = await db
          .select()
          .from(documentosCompra)
          .where(and(eq(documentosCompra.empresaId, empresaId), inArray(documentosCompra.id, de("documentos_compra"))));
        for (const d of filas) {
          poner("documentos_compra", d.id, {
            tipo: TIPO_COMPRA[d.docTipo] ?? d.docTipo,
            numero: `${d.numeroInterno ?? "Sin número"}${d.folio ? ` · Folio ${d.folio}` : ""}`,
            estado: d.estado,
            fecha: d.fechaEmision,
            monto: d.montoTotal,
          });
        }
      })(),
    );
  }
  if (de("documentos_venta").length) {
    trabajos.push(
      (async () => {
        const filas = await db
          .select()
          .from(documentosVenta)
          .where(and(eq(documentosVenta.empresaId, empresaId), inArray(documentosVenta.id, de("documentos_venta"))));
        for (const d of filas) {
          poner("documentos_venta", d.id, {
            tipo: TIPO_VENTA[d.clase] ?? d.clase,
            numero: `${d.numeroInterno ?? "Sin número"}${d.folio ? ` · Folio ${d.folio}` : ""}`,
            estado: d.estado,
            fecha: d.fechaEmision,
            monto: d.montoTotal,
          });
        }
      })(),
    );
  }
  if (de("pagos").length) {
    trabajos.push(
      (async () => {
        const filas = await db
          .select()
          .from(pagos)
          .where(and(eq(pagos.empresaId, empresaId), inArray(pagos.id, de("pagos"))));
        for (const d of filas) {
          poner("pagos", d.id, {
            tipo: d.tipo === "Recibido" ? "Pago recibido" : "Pago efectuado",
            numero: d.numeroInterno,
            estado: d.estado,
            fecha: d.fechaPago,
            monto: d.montoTotal,
            pagoTipo: d.tipo,
          });
        }
      })(),
    );
  }
  if (de("cheques").length) {
    trabajos.push(
      (async () => {
        const filas = await db
          .select()
          .from(cheques)
          .where(and(eq(cheques.empresaId, empresaId), inArray(cheques.id, de("cheques"))));
        for (const d of filas) {
          poner("cheques", d.id, {
            tipo: d.tipo === "Recibido" ? "Cheque recibido" : "Cheque emitido",
            numero: `N° ${d.numero}`,
            estado: d.estado,
            fecha: d.fechaEmision,
            monto: d.monto,
          });
        }
      })(),
    );
  }
  if (de("depositos").length) {
    trabajos.push(
      (async () => {
        const filas = await db
          .select()
          .from(depositos)
          .where(and(eq(depositos.empresaId, empresaId), inArray(depositos.id, de("depositos"))));
        for (const d of filas) {
          poner("depositos", d.id, { tipo: "Depósito", numero: d.numeroInterno, estado: d.estado, fecha: d.fecha, monto: d.montoTotal });
        }
      })(),
    );
  }
  if (de("asientos_contables").length) {
    trabajos.push(
      (async () => {
        const filas = await db
          .select()
          .from(asientosContables)
          .where(and(eq(asientosContables.empresaId, empresaId), inArray(asientosContables.id, de("asientos_contables"))));
        for (const d of filas) {
          poner("asientos_contables", d.id, {
            tipo: "Asiento contable",
            numero: `${d.correlativo != null ? `N° ${d.correlativo}` : "Borrador"} · ${d.anio}`,
            estado: d.estado,
            fecha: d.fecha,
            monto: null,
          });
        }
      })(),
    );
  }
  if (de("activos_fijos_documentos").length) {
    trabajos.push(
      (async () => {
        const filas = await db
          .select()
          .from(activosFijosDocumentos)
          .where(and(eq(activosFijosDocumentos.empresaId, empresaId), inArray(activosFijosDocumentos.id, de("activos_fijos_documentos"))));
        for (const d of filas) {
          poner("activos_fijos_documentos", d.id, {
            tipo: `Activo fijo (${d.tipoDoc})`,
            numero: `N° ${d.numero} · ${d.anio}`,
            estado: d.estado,
            fecha: d.fecha,
            monto: null,
          });
        }
      })(),
    );
  }
  if (de("activos_fijos").length) {
    trabajos.push(
      (async () => {
        const filas = await db
          .select()
          .from(activosFijos)
          .where(and(eq(activosFijos.empresaId, empresaId), inArray(activosFijos.id, de("activos_fijos"))));
        for (const d of filas) {
          poner("activos_fijos", d.id, {
            tipo: "Activo fijo",
            numero: `${d.codigo} · ${d.descripcion}`,
            estado: d.estado,
            fecha: d.fechaAdquisicion,
            monto: null,
          });
        }
      })(),
    );
  }
  if (de("cierres_ejercicio").length) {
    trabajos.push(
      (async () => {
        const filas = await db
          .select()
          .from(cierresEjercicio)
          .where(and(eq(cierresEjercicio.empresaId, empresaId), inArray(cierresEjercicio.id, de("cierres_ejercicio"))));
        for (const d of filas) {
          poner("cierres_ejercicio", d.id, {
            tipo: "Cierre de ejercicio",
            numero: String(d.anio),
            estado: d.estado,
            fecha: null,
            monto: d.montoResultado,
            anio: d.anio,
          });
        }
      })(),
    );
  }
  await Promise.all(trabajos);
  return nodos;
}

/** Cliente o proveedor de la cadena: el del documento consultado o, si no tiene, el del primero que lo tenga. */
async function obtenerSocio(empresaId: string, nodos: NodoMapa[]): Promise<SocioMapa | null> {
  const conSocio = new Set<TablaMapa>(["documentos_compra", "documentos_venta", "pagos", "cheques"]);
  const candidatos = [...nodos].filter((n) => conSocio.has(n.tabla)).sort((a, b) => Number(b.raiz) - Number(a.raiz));
  for (const n of candidatos) {
    const t = n.tabla === "documentos_compra" ? documentosCompra : n.tabla === "documentos_venta" ? documentosVenta : n.tabla === "pagos" ? pagos : cheques;
    const [fila] = (await db
      .select({ terceroId: t.terceroId })
      .from(t as unknown as PgTable)
      .where(and(eq(t.empresaId, empresaId), eq(t.id, n.id)))) as { terceroId: string }[];
    if (!fila) continue;
    const [socio] = await db
      .select({ id: terceros.id, rut: terceros.rut, razonSocial: terceros.razonSocial })
      .from(terceros)
      .where(and(eq(terceros.id, fila.terceroId), eq(terceros.empresaId, empresaId)));
    if (socio) return socio;
  }
  return null;
}

const aFrontera = (claves: Iterable<string>): Frontera => {
  const f: Frontera = new Map();
  for (const c of claves) {
    const { tabla, id } = refDeClave(c);
    f.set(tabla, [...(f.get(tabla) ?? []), id]);
  }
  return f;
};

/**
 * Recorre los vínculos en ambos sentidos desde un registro y devuelve el grafo conexo
 * (acotado en niveles y cantidad de nodos). `null` si el registro no existe en la empresa.
 */
export async function obtenerMapaRelaciones(empresaId: string, tabla: TablaMapa, id: string): Promise<MapaRelaciones | null> {
  const raiz = claveMapa(tabla, id);
  const visitados = new Set<string>([raiz]);
  const aristas = new Map<string, Arista>();
  let frontera = aFrontera([raiz]);
  let truncado = false;

  for (let nivel = 0; nivel < MAX_NIVELES; nivel++) {
    const encontradas = await expandir(empresaId, frontera);
    const nuevos = new Set<string>();
    for (const a of encontradas) {
      aristas.set(`${a.desde}>${a.hasta}|${a.tipo}`, a);
      for (const c of [a.desde, a.hasta]) if (!visitados.has(c)) nuevos.add(c);
    }
    if (nuevos.size === 0) break;
    const admitidos: string[] = [];
    for (const c of nuevos) {
      if (visitados.size >= MAX_NODOS) {
        truncado = true;
        break;
      }
      visitados.add(c);
      admitidos.push(c);
    }
    if (admitidos.length === 0) break;
    frontera = aFrontera(admitidos);
  }

  const nodos = await cargarNodos(empresaId, aFrontera(visitados), raiz);
  if (!nodos.has(raiz)) return null;
  return {
    raiz,
    socio: await obtenerSocio(empresaId, [...nodos.values()]),
    nodos: [...nodos.values()],
    aristas: [...aristas.values()].filter((a) => nodos.has(a.desde) && nodos.has(a.hasta)),
    truncado,
  };
}
