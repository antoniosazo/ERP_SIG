import { z } from "zod";

/** Grupo de socios de negocio (segmentación / reportería) — catálogo por empresa. */
const camposGrupoBase = {
  codigo: z
    .string()
    .trim()
    .min(1, "Código requerido")
    .max(20)
    .transform((v) => v.toUpperCase()),
  nombre: z.string().trim().min(1, "Nombre requerido").max(100),
};

export const crearGrupoTerceroSchema = z.object(camposGrupoBase);
export type CrearGrupoTerceroInput = z.infer<typeof crearGrupoTerceroSchema>;

export const editarGrupoTerceroSchema = z.object(camposGrupoBase);
export type EditarGrupoTerceroInput = z.infer<typeof editarGrupoTerceroSchema>;
