import { z } from "zod";
import { fechaISO, uuid } from "./primitives";

/** Una fila de cartola ya mapeada (fecha/monto parseados con el formato del banco), tal
 * como la produce el parser en el cliente/servidor y como viaja de la previa a la
 * confirmación — no se vuelve a subir ni a parsear el archivo en el segundo paso. */
export const filaCartolaMapeadaSchema = z.object({
  fecha: fechaISO,
  descripcion: z.string().trim().min(1, "Descripción requerida"),
  nroDocumento: z.string().trim().max(40).nullish(),
  rutContraparte: z.string().trim().max(20).nullish(),
  monto: z.number().refine((n) => n !== 0, "El monto no puede ser cero"),
  codigoTransaccion: z.string().trim().max(40).nullish(),
});
export type FilaCartolaMapeada = z.infer<typeof filaCartolaMapeadaSchema>;

export const previsualizarCartolaSchema = z.object({
  cuentaBancariaId: uuid,
  formatoId: uuid,
  archivoNombre: z.string().trim().min(1),
  archivoBase64: z.string().min(1),
  saldoInicial: z.number(),
  saldoFinal: z.number(),
});
export type PrevisualizarCartolaInput = z.infer<typeof previsualizarCartolaSchema>;

export const confirmarImportacionCartolaSchema = z.object({
  archivoNombre: z.string().trim().min(1).nullish(),
  archivoHash: z.string().trim().min(1).nullish(),
  fechaDesde: fechaISO,
  fechaHasta: fechaISO,
  saldoInicial: z.number(),
  saldoFinal: z.number(),
  filas: z.array(filaCartolaMapeadaSchema).min(1, "No hay filas para importar"),
});
export type ConfirmarImportacionCartolaInput = z.infer<typeof confirmarImportacionCartolaSchema>;

export const agregarMovimientoManualSchema = z.object({
  fecha: fechaISO,
  descripcion: z.string().trim().min(1, "Descripción requerida").max(255),
  monto: z.number().refine((n) => n !== 0, "El monto no puede ser cero"),
  nroDocumento: z.string().trim().max(40).nullish(),
  rutContraparte: z.string().trim().max(20).nullish(),
});
export type AgregarMovimientoManualInput = z.infer<typeof agregarMovimientoManualSchema>;
