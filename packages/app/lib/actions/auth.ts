"use server";

import { signIn, signOut } from "@/auth";
import { activarCuentaConToken } from "@erp/db";
import { activarCuentaSchema, loginSchema, type ActivarCuentaInput, type LoginInput } from "@erp/shared";
import { AuthError } from "next-auth";

export type AccionResultado = { ok: true } | { ok: false; error: string };

export async function loginAction(input: LoginInput): Promise<AccionResultado> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Email o contraseña incorrectos" };
    }
    throw error;
  }

  return { ok: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function activarCuentaAction(input: ActivarCuentaInput): Promise<AccionResultado> {
  const parsed = activarCuentaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const exito = await activarCuentaConToken(parsed.data.token, parsed.data.password);
  if (!exito) {
    return { ok: false, error: "Este link no es válido, ya fue usado, o expiró" };
  }

  return { ok: true };
}
