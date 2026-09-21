import { z } from "zod";
import { DOCUMENTO_COMPRA_TIPO, DOCUMENTO_MODALIDAD, IVA_RECUPERABLE } from "../enums";
import { fechaISO, uuid } from "./primitives";

/** Alta rápida de un documento de compra: tipo interno + tipo SII + proveedor. */
export const crearDocumentoCompraSchema = z.object({
  docTipo: z.enum(DOCUMENTO_COMPRA_TIPO),
  tipoDocumentoId: uuid,
  terceroId: uuid,
  documentoBaseId: uuid.nullish(),
});
export type CrearDocumentoCompraInput = z.infer<typeof crearDocumentoCompraSchema>;

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
  tipoDocumentoId: uuid,
  folio: z.string().trim().max(40).nullish(),
  fechaEmision: fechaISO,
  fechaVencimiento: fechaISO,
  fechaContabilizacion: fechaISO,
  numAtCard: z.string().trim().max(60).nullish(),
  monedaId: uuid,
  tipoCambio: z.number().min(0),
  descuentoGlobalPct: z.number().min(0).max(100).default(0),
  condicionPagoDias: z.number().int().min(0).max(3650).nullish(),
  glosa: z.string().trim().max(1000).nullish(),
  documentoBaseId: uuid.nullish(),
  lineas: z.array(lineaCompraSchema).min(1, "Agrega al menos una línea").max(200),
  })
  .superRefine((v, ctx) => {
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
});
export type AnularDocumentoCompraInput = z.infer<typeof anularDocumentoCompraSchema>;

/** "Traer desde documento base": copia líneas seleccionadas (con su cantidad) a un doc nuevo. */
export const traerDesdeDocumentoSchema = z.object({
  documentoBaseId: uuid,
  docTipoDestino: z.enum(DOCUMENTO_COMPRA_TIPO),
  lineas: z
    .array(z.object({ lineaBaseId: uuid, cantidad: z.number().positive() }))
    .min(1, "Selecciona al menos una línea"),
});
export type TraerDesdeDocumentoInput = z.infer<typeof traerDesdeDocumentoSchema>;
