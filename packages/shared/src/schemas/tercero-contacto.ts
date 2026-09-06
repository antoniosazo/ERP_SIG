import { z } from "zod";

/** Contacto (persona) de un socio de negocio — sub-entidad de `terceros`. */
const camposContactoBase = {
  nombre: z.string().trim().min(1, "Nombre requerido").max(100),
  apellido: z.string().trim().max(100).nullish(),
  cargo: z.string().trim().max(100).nullish(),
  telefono: z.string().trim().max(40).nullish(),
  movil: z.string().trim().max(40).nullish(),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email inválido")
    .nullish(),
  activo: z.boolean().default(true),
};

export const crearContactoSchema = z.object(camposContactoBase);
export type CrearContactoInput = z.infer<typeof crearContactoSchema>;

export const editarContactoSchema = z.object(camposContactoBase);
export type EditarContactoInput = z.infer<typeof editarContactoSchema>;
