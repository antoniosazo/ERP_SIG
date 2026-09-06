import { z } from "zod";
import { ROL } from "../enums";
import { uuid } from "./primitives";

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;

const asignacionEmpresaSchema = z.object({
  empresaId: uuid,
  rol: z.enum(ROL),
});

/** Alta de un contador por invitación (módulo 4.9-E) — sin envío de email: genera un token. */
export const invitarUsuarioSchema = z
  .object({
    nombre: z.string().min(1, "Nombre requerido").max(200),
    email: z.email("Email inválido"),
    // Acceso a "mi firma" y a /admin/usuarios (gestión de firma, no de una empresa cliente).
    esAdminFirma: z.boolean().default(false),
    empresas: z.array(asignacionEmpresaSchema),
  })
  .refine((data) => data.esAdminFirma || data.empresas.length > 0, {
    message: "Asigna al menos una empresa, o márcalo como Administrador de la firma",
    path: ["empresas"],
  });

export type InvitarUsuarioInput = z.infer<typeof invitarUsuarioSchema>;

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres");

/** El contador define su contraseña al activar la cuenta (o al resetearla). */
export const activarCuentaSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmarPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmarPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarPassword"],
  });

export type ActivarCuentaInput = z.infer<typeof activarCuentaSchema>;
