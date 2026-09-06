import { z } from "zod";
import { IMPUESTO_TIPO, IVA_RECUPERABLE, TIPO_OPERACION_DOCUMENTO } from "../enums";
import { uuid } from "./primitives";

/**
 * Maestro de impuestos por empresa (enfoque Chile). `recuperableDefault` solo aplica a
 * `IVA Crédito`; la UI lo condiciona, el schema lo deja opcional.
 */
const camposImpuestoBase = {
  codigo: z
    .string()
    .trim()
    .min(1, "Código requerido")
    .max(20)
    .transform((v) => v.toUpperCase()),
  nombre: z.string().trim().min(1, "Nombre requerido").max(100),
  tipo: z.enum(IMPUESTO_TIPO),
  tasa: z.number().min(0).max(100),
  cuentaContableId: uuid.nullish(),
  recuperableDefault: z.enum(IVA_RECUPERABLE).nullish(),
  aplicaA: z.enum(TIPO_OPERACION_DOCUMENTO),
  activo: z.boolean().default(true),
};

export const crearImpuestoSchema = z.object(camposImpuestoBase);
export type CrearImpuestoInput = z.infer<typeof crearImpuestoSchema>;

export const editarImpuestoSchema = z.object(camposImpuestoBase);
export type EditarImpuestoInput = z.infer<typeof editarImpuestoSchema>;
