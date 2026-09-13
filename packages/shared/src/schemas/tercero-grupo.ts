import { z } from "zod";
import { uuid } from "./primitives";

/**
 * Grupo de socios de negocio (segmentación / reportería) — catálogo por empresa.
 * `cuentaContableAsociadaId`/`categoriaContableDefaultId`: nivel intermedio de
 * determinación de cuentas entre el tercero y el fallback GENERAL (ver terceros-grupos.ts).
 */
const camposGrupoBase = {
  codigo: z
    .string()
    .trim()
    .min(1, "Código requerido")
    .max(20)
    .transform((v) => v.toUpperCase()),
  nombre: z.string().trim().min(1, "Nombre requerido").max(100),
  cuentaContableAsociadaId: uuid.nullish(),
  categoriaContableDefaultId: uuid.nullish(),
};

export const crearGrupoTerceroSchema = z.object(camposGrupoBase);
export type CrearGrupoTerceroInput = z.infer<typeof crearGrupoTerceroSchema>;

export const editarGrupoTerceroSchema = z.object(camposGrupoBase);
export type EditarGrupoTerceroInput = z.infer<typeof editarGrupoTerceroSchema>;
