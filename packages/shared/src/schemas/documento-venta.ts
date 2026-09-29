import { z } from "zod";
import { DOCUMENTO_MODALIDAD, DOCUMENTO_VENTA_CLASE, type DocumentoVentaClase } from "../enums";
import { fechaISO, uuid } from "./primitives";

/** Alta rápida de un documento de venta: clase + tipo SII + cliente. El resto va en el detalle. */
export const crearDocumentoVentaSchema = z.object({
  clase: z.enum(DOCUMENTO_VENTA_CLASE),
  tipoDocumentoId: uuid,
  terceroId: uuid,
});
export type CrearDocumentoVentaInput = z.infer<typeof crearDocumentoVentaSchema>;

/** Tipos tributarios compatibles con cada clase de documento de venta. */
export const CODIGOS_SII_VENTA_POR_CLASE: Record<DocumentoVentaClase, readonly string[]> = {
  Factura: ["33", "34", "46"],
  "Nota de Crédito": ["61"],
  "Nota de Débito": ["56"],
};

export function codigoSiiPermitidoParaVenta(clase: DocumentoVentaClase, codigoSii: string) {
  return CODIGOS_SII_VENTA_POR_CLASE[clase].includes(codigoSii);
}

const lineaSchema = z.object({
  glosa: z.string().trim().max(300).nullish(),
  productoId: uuid.nullish(),
  cuentaIngresoId: uuid,
  categoriaContableId: uuid.nullish(),
  centroCostoId: uuid.nullish(),
  impuestoId: uuid.nullish(),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0),
  descuentoLineaPct: z.number().min(0).max(100).default(0),
  esExento: z.boolean().default(false),
  fechaDiferimiento: fechaISO.nullish(),
});

/** Guardado completo de un documento en borrador (cabecera + líneas). Totales los recalcula el backend. */
export const guardarDocumentoVentaSchema = z
  .object({
  modalidad: z.enum(DOCUMENTO_MODALIDAD).default("Artículo"),
  terceroId: uuid,
  tipoDocumentoId: uuid,
  folio: z.string().trim().min(1, "Indica el folio SII").max(40),
  fechaEmision: fechaISO,
  fechaVencimiento: fechaISO,
  fechaContabilizacion: fechaISO,
  numAtCard: z.string().trim().max(60).nullish(),
  monedaId: uuid,
  tipoCambio: z.number().positive("El tipo de cambio debe ser mayor a 0"),
  descuentoGlobalPct: z.number().min(0).max(100).default(0),
  glosa: z.string().trim().max(1000).nullish(),
  documentoReferenciaId: uuid.nullish(),
  nombreCliente: z.string().trim().max(200).nullish(),
  condicionPagoDias: z.number().int().min(0).max(3650).nullish(),
  vendedorId: uuid.nullish(),
  contactoId: uuid.nullish(),
  direccionFacturacion: z.string().trim().max(300).nullish(),
  direccionDespacho: z.string().trim().max(300).nullish(),
  lineas: z.array(lineaSchema).min(1, "Agrega al menos una línea").max(200),
  })
  .superRefine((v, ctx) => {
    if (v.modalidad !== "Servicio") return;
    v.lineas.forEach((l, i) => {
      if (!l.glosa?.trim()) {
        ctx.addIssue({ code: "custom", path: ["lineas", i, "glosa"], message: "En un documento de servicio la descripción es obligatoria" });
      }
    });
  });
export type GuardarDocumentoVentaInput = z.infer<typeof guardarDocumentoVentaSchema>;

export const anularDocumentoVentaSchema = z.object({
  motivo: z.string().trim().min(1, "Indica el motivo").max(500),
  fechaReversa: fechaISO,
});
export type AnularDocumentoVentaInput = z.infer<typeof anularDocumentoVentaSchema>;

/** Emisión de una nota de crédito a partir de una factura contabilizada. */
export const emitirNotaCreditoSchema = z.object({
  facturaId: uuid,
  tipoDocumentoId: uuid,
  montoMaximo: z.number().positive("El monto debe ser mayor a 0"),
});
export type EmitirNotaCreditoInput = z.infer<typeof emitirNotaCreditoSchema>;
