import { z } from "zod";
import { DOCUMENTO_COMPRA_TIPO, DOCUMENTO_MODALIDAD, IVA_RECUPERABLE, type DocumentoCompraTipo } from "../enums";
import { fechaISO, uuid } from "./primitives";

/** Alta rápida de un documento de compra: tipo interno + tipo SII + proveedor. */
export const crearDocumentoCompraSchema = z
  .object({
    docTipo: z.enum(DOCUMENTO_COMPRA_TIPO),
    tipoDocumentoId: uuid.nullish(),
    terceroId: uuid,
    documentoBaseId: uuid.nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.docTipo !== "pedido" && !v.tipoDocumentoId) {
      ctx.addIssue({ code: "custom", path: ["tipoDocumentoId"], message: "Selecciona el tipo de documento" });
    }
  });
export type CrearDocumentoCompraInput = z.infer<typeof crearDocumentoCompraSchema>;

/** Tipos SII válidos para documentos tributarios de compra. */
export const CODIGOS_SII_COMPRA_POR_TIPO: Partial<Record<DocumentoCompraTipo, readonly string[]>> = {
  factura: ["33", "34", "46", "HON"],
  nota_credito: ["61"],
  nota_debito: ["56"],
};

export function codigoSiiPermitidoParaCompra(tipo: DocumentoCompraTipo, codigoSii: string) {
  const permitidos = CODIGOS_SII_COMPRA_POR_TIPO[tipo];
  return permitidos ? permitidos.includes(codigoSii) : true;
}

/** Transiciones admitidas por el flujo logístico de compras. */
export function destinoDesdeDocumentoPermitido(
  origen: DocumentoCompraTipo,
  destino: DocumentoCompraTipo,
) {
  if (origen === "pedido") return destino === "entrada_mercaderia" || destino === "factura";
  return origen === "entrada_mercaderia" && destino === "factura";
}

/** Costo neto unitario de una recepción, incluidos descuentos e IVA no recuperable. */
export function costoUnitarioNetoEntrada(cantidad: number, montoNeto: number) {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return 0;
  return montoNeto / cantidad;
}

/** Valor de GR-IR que corresponde a una cantidad facturada de una recepción. */
export function montoGrIrParaCantidad(
  cantidadBase: number,
  montoNetoBase: number,
  cantidadFacturada: number,
) {
  return costoUnitarioNetoEntrada(cantidadBase, montoNetoBase) * cantidadFacturada;
}

const lineaCompraSchema = z.object({
  glosa: z.string().trim().max(300).nullish(),
  productoId: uuid.nullish(),
  cuentaImputacionId: uuid,
  categoriaContableId: uuid.nullish(),
  centroCostoId: uuid.nullish(),
  impuestoId: uuid.nullish(),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0),
  descuentoLineaPct: z.number().min(0).max(100).default(0),
  esExento: z.boolean().default(false),
  ivaRecuperable: z.enum(IVA_RECUPERABLE).nullish(),
});
export type LineaCompraInput = z.infer<typeof lineaCompraSchema>;

/** Guardado completo de un documento de compra en borrador. Totales los recalcula el backend. */
export const guardarDocumentoCompraSchema = z
  .object({
  docTipo: z.enum(DOCUMENTO_COMPRA_TIPO),
  modalidad: z.enum(DOCUMENTO_MODALIDAD).default("Artículo"),
  terceroId: uuid,
  tipoDocumentoId: uuid.nullish(),
  folio: z.string().trim().max(40).nullish(),
  fechaEmision: fechaISO,
  fechaVencimiento: fechaISO,
  fechaContabilizacion: fechaISO,
  numAtCard: z.string().trim().max(60).nullish(),
  monedaId: uuid,
  tipoCambio: z.number().positive("El tipo de cambio debe ser mayor a 0"),
  descuentoGlobalPct: z.number().min(0).max(100).default(0),
  condicionPagoDias: z.number().int().min(0).max(3650).nullish(),
  glosa: z.string().trim().max(1000).nullish(),
  documentoBaseId: uuid.nullish(),
  lineas: z.array(lineaCompraSchema).min(1, "Agrega al menos una línea").max(200),
  })
  .superRefine((v, ctx) => {
    if (v.docTipo !== "pedido" && !v.tipoDocumentoId) {
      ctx.addIssue({ code: "custom", path: ["tipoDocumentoId"], message: "Selecciona el tipo de documento" });
    }
    if (["factura", "nota_credito", "nota_debito"].includes(v.docTipo) && !v.folio?.trim()) {
      ctx.addIssue({ code: "custom", path: ["folio"], message: "Indica el folio SII" });
    }
    if ((v.docTipo === "nota_credito" || v.docTipo === "nota_debito") && !v.documentoBaseId) {
      ctx.addIssue({ code: "custom", path: ["documentoBaseId"], message: "Indica la factura que corrige" });
    }
    if (v.fechaVencimiento < v.fechaEmision) {
      ctx.addIssue({ code: "custom", path: ["fechaVencimiento"], message: "El vencimiento no puede ser anterior a la emisión" });
    }
    if (v.modalidad !== "Servicio") return;
    if (v.docTipo === "entrada_mercaderia") {
      ctx.addIssue({ code: "custom", path: ["modalidad"], message: "Una entrada de mercadería no puede ser de tipo Servicio" });
    }
    v.lineas.forEach((l, i) => {
      if (!l.glosa?.trim()) {
        ctx.addIssue({ code: "custom", path: ["lineas", i, "glosa"], message: "En un documento de servicio la descripción es obligatoria" });
      }
    });
  });
export type GuardarDocumentoCompraInput = z.infer<typeof guardarDocumentoCompraSchema>;

export const anularDocumentoCompraSchema = z.object({
  motivo: z.string().trim().min(1, "Indica el motivo").max(500),
  fechaReversa: fechaISO,
});
export type AnularDocumentoCompraInput = z.infer<typeof anularDocumentoCompraSchema>;

/** "Traer desde documento base": copia líneas seleccionadas (con su cantidad) a un doc nuevo. */
export const traerDesdeDocumentoSchema = z.object({
  documentoBaseId: uuid,
  docTipoDestino: z.enum(DOCUMENTO_COMPRA_TIPO),
  /** Tipo SII del documento nuevo: obligatorio al crear una factura, pues el pedido no lo tiene. */
  tipoDocumentoId: uuid.nullish(),
  lineas: z
    .array(z.object({ lineaBaseId: uuid, cantidad: z.number().positive() }))
    .min(1, "Selecciona al menos una línea"),
}).superRefine((v, ctx) => {
  if (v.docTipoDestino === "factura" && !v.tipoDocumentoId) {
    ctx.addIssue({ code: "custom", path: ["tipoDocumentoId"], message: "Selecciona el tipo de documento de la factura" });
  }
  const ids = new Set<string>();
  v.lineas.forEach((linea, i) => {
    if (ids.has(linea.lineaBaseId)) {
      ctx.addIssue({
        code: "custom",
        path: ["lineas", i, "lineaBaseId"],
        message: "No se puede seleccionar dos veces la misma línea",
      });
    }
    ids.add(linea.lineaBaseId);
  });
});
export type TraerDesdeDocumentoInput = z.infer<typeof traerDesdeDocumentoSchema>;
