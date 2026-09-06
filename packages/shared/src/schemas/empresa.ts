import { z } from "zod";
import { EMPRESA_ESTADO } from "../enums";
import { esRutValido } from "../rut";
import { fechaISO, uuid } from "./primitives";

const camposEmpresaBase = {
  rut: z
    .string()
    .min(3, "RUT requerido")
    .refine(esRutValido, "RUT inválido (verifica el dígito verificador)"),
  razonSocial: z.string().min(1, "Razón social requerida").max(200),
  giro: z.string().min(1, "Giro requerido").max(200),
  direccion: z.string().max(300).optional(),
  regimenTributario: z.string().min(1, "Régimen tributario requerido").max(100),
  fechaInicioActividades: fechaISO,
  monedaFuncionalId: uuid,
  monedaReporteId: uuid.optional(),
  permiteMultimoneda: z.boolean().default(false),
  aplicaIfrs: z.boolean().default(false),
  planCuentasPlantillaId: uuid,
  fechaPrimerPeriodoContable: fechaISO,
  estado: z.enum(EMPRESA_ESTADO).default("Activa"),
};

const monedaReporteDistinta = {
  refine: (data: { monedaReporteId?: string; monedaFuncionalId: string }) =>
    data.monedaReporteId !== data.monedaFuncionalId,
  opts: {
    message: "La moneda de reporte debe ser distinta a la moneda funcional",
    path: ["monedaReporteId"],
  },
};

/**
 * Lo que completa el usuario en el asistente de alta de empresa (módulo 4.9-A).
 * `firmaContableId` NO forma parte de este schema — la asigna el servidor a partir
 * de la sesión (`requireAdminFirma`), nunca se confía en un valor enviado por el cliente.
 */
export const empresaFormSchema = z
  .object(camposEmpresaBase)
  .refine(monedaReporteDistinta.refine, monedaReporteDistinta.opts);

export type EmpresaFormInput = z.infer<typeof empresaFormSchema>;

/**
 * Schema completo usado por el servidor (packages/db) para crear la empresa: crea la
 * empresa, clona el plan de cuentas de la plantilla elegida y abre el primer periodo
 * contable — ver packages/db/src/queries/empresas.ts.
 */
export const crearEmpresaSchema = z
  .object({ firmaContableId: uuid, ...camposEmpresaBase })
  .refine(monedaReporteDistinta.refine, monedaReporteDistinta.opts);

export type CrearEmpresaInput = z.infer<typeof crearEmpresaSchema>;

/**
 * Edición de los "Detalles de la empresa" desde el entorno por empresa (Módulo 4.9-A).
 * No se editan el `rut` (identificador legal), la plantilla de plan de cuentas ni la
 * fecha del primer periodo — esos solo tienen sentido en el alta (Proceso 0).
 */
const {
  rut: _rut,
  planCuentasPlantillaId: _plantilla,
  fechaPrimerPeriodoContable: _fechaPrimerPeriodo,
  fechaInicioActividades: _fechaInicio,
  ...camposEmpresaEditable
} = camposEmpresaBase;

export const editarEmpresaSchema = z
  .object({
    ...camposEmpresaEditable,
    // En edición la fecha de inicio de actividades puede quedar en blanco (empresas
    // antiguas migradas sin el dato); "" se normaliza a null en la capa de datos.
    fechaInicioActividades: fechaISO.or(z.literal("")).optional(),
  })
  .refine(monedaReporteDistinta.refine, monedaReporteDistinta.opts);

export type EditarEmpresaInput = z.infer<typeof editarEmpresaSchema>;
