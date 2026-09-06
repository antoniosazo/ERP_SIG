import { z } from "zod";
import { TIPO_TERCERO } from "../enums";
import { esRutValido } from "../rut";
import { uuid } from "./primitives";

/**
 * Maestro de Terceros / socios de negocio por empresa (3.6), estilo OCRD de SAP B1:
 * cabecera enriquecida + sub-entidades (contactos, direcciones, cuentas bancarias).
 * `cuentaContableAsociadaId` es la cuenta "puente" agregada (ej. "Clientes Nacionales").
 */
const camposTerceroBase = {
  rut: z
    .string()
    .min(3, "RUT requerido")
    .refine(esRutValido, "RUT inválido (verifica el dígito verificador)"),
  razonSocial: z.string().min(1, "Razón social requerida").max(200),
  tipoTercero: z.enum(TIPO_TERCERO),
  nombreFantasia: z.string().trim().max(200).nullish(),
  giro: z.string().trim().max(200).nullish(),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email inválido")
    .nullish(),
  telefono: z.string().trim().max(40).nullish(),
  sitioWeb: z.string().trim().max(200).nullish(),
  direccion: z.string().trim().max(300).nullish(),
  notas: z.string().trim().max(2000).nullish(),
  grupoId: uuid.nullish(),
  monedaId: uuid.nullish(),
  impuestoDefaultId: uuid.nullish(),
  cuentaContableAsociadaId: uuid.nullish(),
  categoriaContableDefaultId: uuid.nullish(),
  condicionPagoDias: z.number().int().min(0).max(365).default(0),
  limiteCredito: z.number().min(0).default(0),
  retencionHonorariosPct: z.number().min(0).max(100).nullish(),
  esEmisorBoletaHonorarios: z.boolean().default(false),
  esReceptorBoletaHonorarios: z.boolean().default(false),
  pendienteCompletar: z.boolean().default(false),
  activo: z.boolean().default(true),
  bloqueado: z.boolean().default(false),
  motivoBloqueo: z.string().trim().max(500).nullish(),
};

/** Alta rápida: solo lo indispensable; el resto se completa en el detalle. */
export const crearTerceroSchema = z.object({
  rut: camposTerceroBase.rut,
  razonSocial: camposTerceroBase.razonSocial,
  tipoTercero: camposTerceroBase.tipoTercero,
});
export type CrearTerceroInput = z.infer<typeof crearTerceroSchema>;

export const editarTerceroSchema = z.object(camposTerceroBase);
export type EditarTerceroInput = z.infer<typeof editarTerceroSchema>;
