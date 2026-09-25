import { z } from "zod";
import {
  CARTOLA_CAMPO_DESTINO,
  CARTOLA_CODIFICACION,
  CARTOLA_FORMATO_FECHA,
  CARTOLA_FORMATO_NUMERO,
  CARTOLA_REGLA_SIGNO,
  CARTOLA_TIPO_ARCHIVO,
} from "../enums";
import { uuid } from "./primitives";

const campoFormatoCartolaSchema = z.object({
  campoDestino: z.enum(CARTOLA_CAMPO_DESTINO),
  columnaIndice: z.number().int().min(0).nullish(),
  posicionInicio: z.number().int().min(0).nullish(),
  posicionLargo: z.number().int().min(1).nullish(),
});

/**
 * Plantilla de mapeo de cartola, siempre propia de la empresa que la crea (no se editan
 * plantillas globales desde esta UI — quedan reservadas para un futuro sembrado
 * verificado, igual que vidas útiles SII).
 */
export const guardarFormatoCartolaSchema = z.object({
  id: uuid.nullish(),
  bancoId: uuid,
  nombre: z.string().trim().min(1, "Nombre requerido").max(120),
  tipoArchivo: z.enum(CARTOLA_TIPO_ARCHIVO),
  codificacion: z.enum(CARTOLA_CODIFICACION).default("UTF-8"),
  separador: z.string().trim().max(5).nullish(),
  filasOmitirInicio: z.number().int().min(0).default(0),
  filasOmitirFin: z.number().int().min(0).default(0),
  formatoFecha: z.enum(CARTOLA_FORMATO_FECHA),
  formatoNumero: z.enum(CARTOLA_FORMATO_NUMERO),
  reglaSigno: z.enum(CARTOLA_REGLA_SIGNO),
  activo: z.boolean().default(true),
  campos: z.array(campoFormatoCartolaSchema).min(1, "Agrega al menos un campo mapeado"),
});
export type GuardarFormatoCartolaInput = z.infer<typeof guardarFormatoCartolaSchema>;
