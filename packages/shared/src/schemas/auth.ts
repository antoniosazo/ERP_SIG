import { z } from "zod";
import { ROL } from "../enums";
import { emailNormalizado, uuid } from "./primitives";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Ingresa tu email").pipe(z.email("Email inválido")),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;

const asignacionEmpresaSchema = z.object({
  empresaId: uuid,
  rol: z.enum(ROL),
});

/** Reglas comunes de las asignaciones de un usuario: una vez por empresa y, si no es admin de firma, al menos una. */
const reglasAsignaciones = <T extends z.ZodType<{ esAdminFirma: boolean; empresas: { empresaId: string }[] }>>(esquema: T) =>
  esquema
    .refine((data) => data.esAdminFirma || data.empresas.length > 0, {
      message: "Asigna al menos una empresa, o márcalo como Administrador de la firma",
      path: ["empresas"],
    })
    .refine((data) => new Set(data.empresas.map((e) => e.empresaId)).size === data.empresas.length, {
      message: "Cada empresa solo puede asignarse una vez",
      path: ["empresas"],
    });

/** Alta de un contador por invitación (módulo 4.9-E) — sin envío de email: genera un token. */
export const invitarUsuarioSchema = reglasAsignaciones(
  z.object({
    nombre: z.string().trim().min(1, "Nombre requerido").max(200),
    email: emailNormalizado,
    // Acceso a "mi firma" y a /admin/usuarios (gestión de firma, no de una empresa cliente).
    esAdminFirma: z.boolean().default(false),
    empresas: z.array(asignacionEmpresaSchema),
  }),
);

export type InvitarUsuarioInput = z.infer<typeof invitarUsuarioSchema>;

/**
 * Edición de un usuario de la firma. El email solo se corrige mientras la cuenta sigue en
 * "Invitado" (aún no la activó); después es su identidad y no se cambia.
 */
export const editarUsuarioSchema = reglasAsignaciones(
  z.object({
    nombre: z.string().trim().min(1, "Nombre requerido").max(200),
    email: emailNormalizado.optional(),
    esAdminFirma: z.boolean(),
    empresas: z.array(asignacionEmpresaSchema),
  }),
);

export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;

export const ACCION_ESTADO_USUARIO = ["suspender", "reactivar"] as const;
export type AccionEstadoUsuario = (typeof ACCION_ESTADO_USUARIO)[number];

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
