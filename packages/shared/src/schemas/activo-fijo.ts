import { z } from "zod";
import {
  ACTIVO_FIJO_METODO_DEP,
  ACTIVO_FIJO_REGLA_BAJA,
  ACTIVO_FIJO_REGLA_INICIO,
  ACTIVO_FIJO_TIPO,
  LIBRO_CONTABLE,
} from "../enums";
import { fechaISO, uuid } from "./primitives";

/** Módulo de Activo Fijo — Fase 1 (Núcleo). */

const camposClaseBase = {
  codigo: z.string().min(1, "Código requerido").max(30),
  nombre: z.string().min(1, "Nombre requerido").max(200),
  tipoActivo: z.enum(ACTIVO_FIJO_TIPO).default("Tangible"),
  activa: z.boolean().default(true),
};

export const crearClaseActivoFijoSchema = z.object(camposClaseBase);
export type CrearClaseActivoFijoInput = z.infer<typeof crearClaseActivoFijoSchema>;

export const editarClaseActivoFijoSchema = z.object(camposClaseBase);
export type EditarClaseActivoFijoInput = z.infer<typeof editarClaseActivoFijoSchema>;

/** Cuentas directas de una clase para un libro contable — pisan el fallback GENERAL. */
export const guardarCuentasClaseSchema = z.object({
  libro: z.enum(LIBRO_CONTABLE),
  ctaActivo: uuid.nullish(),
  ctaDepAcumulada: uuid.nullish(),
  ctaGastoDep: uuid.nullish(),
  ctaCompensacionCapitalizacion: uuid.nullish(),
  ctaUtilidadBaja: uuid.nullish(),
  ctaPerdidaBaja: uuid.nullish(),
  ctaValorLibroBaja: uuid.nullish(),
});
export type GuardarCuentasClaseInput = z.infer<typeof guardarCuentasClaseSchema>;

export const valoracionActivoSchema = z.object({
  libro: z.enum(LIBRO_CONTABLE),
  metodoDep: z.enum(ACTIVO_FIJO_METODO_DEP).default("Lineal"),
  reglaInicio: z.enum(ACTIVO_FIJO_REGLA_INICIO).default("Mes siguiente"),
  reglaBaja: z.enum(ACTIVO_FIJO_REGLA_BAJA).default("Hasta mes anterior"),
  fechaInicioDep: fechaISO,
  vidaUtilMeses: z.number().int().positive("La vida útil debe ser mayor a 0"),
  valorResidual: z.number().min(0).default(0),
});
export type ValoracionActivoInput = z.infer<typeof valoracionActivoSchema>;

export const crearActivoFijoSchema = z.object({
  descripcion: z.string().min(1, "Descripción requerida").max(300),
  claseId: uuid,
  centroCostoId: uuid.nullish(),
  ubicacion: z.string().trim().max(200).nullish(),
  numeroSerie: z.string().trim().max(100).nullish(),
  marca: z.string().trim().max(100).nullish(),
  modelo: z.string().trim().max(100).nullish(),
  fechaAdquisicion: fechaISO.nullish(),
  valoraciones: z
    .array(valoracionActivoSchema)
    .min(1, "Agrega al menos una valoración (libro)")
    .superRefine((valoraciones, ctx) => {
      const libros = new Set(valoraciones.map((v) => v.libro));
      if (libros.size !== valoraciones.length) {
        ctx.addIssue({ code: "custom", message: "No repitas el mismo libro en dos valoraciones" });
      }
    }),
});
export type CrearActivoFijoInput = z.infer<typeof crearActivoFijoSchema>;

const capitalizarLineaSchema = z.object({
  libro: z.enum(LIBRO_CONTABLE),
  importe: z.number().positive("El importe debe ser mayor a 0"),
});

export const capitalizarActivoSchema = z.object({
  fecha: fechaISO,
  glosa: z.string().trim().max(300).nullish(),
  lineas: z.array(capitalizarLineaSchema).min(1, "Indica el costo de capitalización por libro"),
});
export type CapitalizarActivoInput = z.infer<typeof capitalizarActivoSchema>;

export const ejecutarDepreciacionSchema = z.object({
  libro: z.enum(LIBRO_CONTABLE),
  periodoId: uuid,
  modo: z.enum(["simulacion", "real"]),
});
export type EjecutarDepreciacionInput = z.infer<typeof ejecutarDepreciacionSchema>;

/** Módulo de Activo Fijo — Fase 2 (ciclo de vida completo). */

/** Mejora u obra en curso: mismo formato que capitalizar (costo por libro). */
export const registrarMejoraSchema = capitalizarActivoSchema;
export type RegistrarMejoraInput = z.infer<typeof registrarMejoraSchema>;

export const activarObraEnCursoSchema = z.object({
  valoraciones: z
    .array(valoracionActivoSchema)
    .min(1, "Agrega al menos una valoración (libro)")
    .superRefine((valoraciones, ctx) => {
      const libros = new Set(valoraciones.map((v) => v.libro));
      if (libros.size !== valoraciones.length) {
        ctx.addIssue({ code: "custom", message: "No repitas el mismo libro en dos valoraciones" });
      }
    }),
});
export type ActivarObraEnCursoInput = z.infer<typeof activarObraEnCursoSchema>;

export const bajaActivoSchema = z
  .object({
    fecha: fechaISO,
    tipo: z.enum(["Venta", "Castigo"]),
    porcentaje: z.number().min(1).max(100).default(100),
    valorVenta: z.number().min(0).nullish(),
    cuentaContrapartidaId: uuid.nullish(),
    glosa: z.string().trim().max(300).nullish(),
  })
  .superRefine((input, ctx) => {
    if (input.tipo === "Venta" && (!input.valorVenta || !input.cuentaContrapartidaId)) {
      ctx.addIssue({
        code: "custom",
        message: "Una baja por venta necesita el valor de venta y la cuenta de contrapartida",
      });
    }
  });
export type BajaActivoInput = z.infer<typeof bajaActivoSchema>;

export const transferirCentroCostoSchema = z.object({
  fecha: fechaISO,
  centroCostoId: uuid,
  glosa: z.string().trim().max(300).nullish(),
});
export type TransferirCentroCostoInput = z.infer<typeof transferirCentroCostoSchema>;

export const transferirClaseSchema = z.object({
  fecha: fechaISO,
  claseId: uuid,
  glosa: z.string().trim().max(300).nullish(),
});
export type TransferirClaseInput = z.infer<typeof transferirClaseSchema>;

export const registrarDepreciacionManualSchema = z.object({
  libro: z.enum(LIBRO_CONTABLE),
  periodoId: uuid,
  monto: z.number().positive("El monto debe ser mayor a 0"),
  glosa: z.string().trim().max(300).nullish(),
});
export type RegistrarDepreciacionManualInput = z.infer<typeof registrarDepreciacionManualSchema>;

export const anularDocumentoActivoFijoSchema = z.object({
  motivo: z.string().trim().min(1, "Indica el motivo de la anulación").max(300),
});
export type AnularDocumentoActivoFijoInput = z.infer<typeof anularDocumentoActivoFijoSchema>;

export const pronosticoDepreciacionSchema = z.object({
  libro: z.enum(LIBRO_CONTABLE),
  meses: z.number().int().min(1).max(60).default(12),
});
export type PronosticoDepreciacionInput = z.infer<typeof pronosticoDepreciacionSchema>;

export const cerrarEjercicioActivoFijoSchema = z.object({
  libro: z.enum(LIBRO_CONTABLE),
  anio: z.number().int().min(2000).max(2100),
});
export type CerrarEjercicioActivoFijoInput = z.infer<typeof cerrarEjercicioActivoFijoSchema>;

export const reabrirEjercicioActivoFijoSchema = z.object({
  libro: z.enum(LIBRO_CONTABLE),
  anio: z.number().int().min(2000).max(2100),
  motivo: z.string().trim().min(1, "Indica el motivo de la reapertura").max(300),
});
export type ReabrirEjercicioActivoFijoInput = z.infer<typeof reabrirEjercicioActivoFijoSchema>;
