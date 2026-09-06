import type {
  CrearContactoInput,
  CrearCuentaBancariaInput,
  CrearDireccionInput,
  EditarContactoInput,
  EditarCuentaBancariaInput,
  EditarDireccionInput,
} from "@erp/shared";
import { formatearRut, normalizarRut } from "@erp/shared";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "../client";
import type { Tx } from "../client";
import {
  terceros,
  tercerosContactos,
  tercerosCuentasBancarias,
  tercerosDirecciones,
} from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

/** Verifica que el tercero pertenezca a la empresa; devuelve datos para la etiqueta de auditoría. */
async function terceroDe(tx: Tx, terceroId: string, empresaId: string) {
  const [t] = await tx
    .select({ id: terceros.id, rut: terceros.rut })
    .from(terceros)
    .where(and(eq(terceros.id, terceroId), eq(terceros.empresaId, empresaId)));
  if (!t) throw new Error("El tercero no existe en esta empresa");
  return t;
}

const auditar = (
  tx: Tx,
  ctx: AuditoriaCtx | undefined,
  empresaId: string,
  tabla: string,
  registroId: string,
  etiqueta: string,
  accion: "crear" | "editar" | "eliminar",
  antes?: unknown,
  despues?: unknown,
) =>
  ctx
    ? registrarAuditoria(tx, { empresaId, ctx, tabla, registroId, etiqueta, accion, antes, despues })
    : Promise.resolve();

// ── Contactos ────────────────────────────────────────────────────────────────

export function listarContactos(terceroId: string) {
  return db
    .select()
    .from(tercerosContactos)
    .where(eq(tercerosContactos.terceroId, terceroId))
    .orderBy(asc(tercerosContactos.nombre));
}

export async function crearContacto(
  terceroId: string,
  empresaId: string,
  input: CrearContactoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const t = await terceroDe(tx, terceroId, empresaId);
    const [fila] = await tx
      .insert(tercerosContactos)
      .values({ terceroId, ...valoresContacto(input) })
      .returning();
    await auditar(
      tx, ctx, empresaId, "terceros_contactos", fila!.id,
      `${formatearRut(t.rut)} · contacto ${fila!.nombre}`, "crear", undefined, fila,
    );
    return fila!;
  });
}

export async function actualizarContacto(
  contactoId: string,
  terceroId: string,
  empresaId: string,
  input: EditarContactoInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const t = await terceroDe(tx, terceroId, empresaId);
    const [antes] = await tx
      .select()
      .from(tercerosContactos)
      .where(and(eq(tercerosContactos.id, contactoId), eq(tercerosContactos.terceroId, terceroId)));
    if (!antes) throw new Error("El contacto no existe");
    const [fila] = await tx
      .update(tercerosContactos)
      .set({ ...valoresContacto(input), updatedAt: new Date() })
      .where(eq(tercerosContactos.id, contactoId))
      .returning();
    await auditar(
      tx, ctx, empresaId, "terceros_contactos", contactoId,
      `${formatearRut(t.rut)} · contacto ${fila!.nombre}`, "editar", antes, fila,
    );
    return fila!;
  });
}

export async function eliminarContacto(
  contactoId: string,
  terceroId: string,
  empresaId: string,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const t = await terceroDe(tx, terceroId, empresaId);
    const [fila] = await tx
      .delete(tercerosContactos)
      .where(and(eq(tercerosContactos.id, contactoId), eq(tercerosContactos.terceroId, terceroId)))
      .returning();
    if (!fila) throw new Error("El contacto no existe");
    await auditar(
      tx, ctx, empresaId, "terceros_contactos", contactoId,
      `${formatearRut(t.rut)} · contacto ${fila.nombre}`, "eliminar", fila, undefined,
    );
    return fila;
  });
}

function valoresContacto(i: CrearContactoInput | EditarContactoInput) {
  return {
    nombre: i.nombre,
    apellido: i.apellido ?? null,
    cargo: i.cargo ?? null,
    telefono: i.telefono ?? null,
    movil: i.movil ?? null,
    email: i.email ? i.email : null,
    activo: i.activo,
  };
}

// ── Direcciones ──────────────────────────────────────────────────────────────

export function listarDirecciones(terceroId: string) {
  return db
    .select()
    .from(tercerosDirecciones)
    .where(eq(tercerosDirecciones.terceroId, terceroId))
    .orderBy(asc(tercerosDirecciones.tipo));
}

async function fijarPrincipalDireccion(
  tx: Tx,
  terceroId: string,
  tipo: string,
  exceptoId?: string,
) {
  const cond = [eq(tercerosDirecciones.terceroId, terceroId), eq(tercerosDirecciones.tipo, tipo as never)];
  if (exceptoId) cond.push(ne(tercerosDirecciones.id, exceptoId));
  await tx.update(tercerosDirecciones).set({ esPrincipal: false }).where(and(...cond));
}

export async function crearDireccion(
  terceroId: string,
  empresaId: string,
  input: CrearDireccionInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const t = await terceroDe(tx, terceroId, empresaId);
    if (input.esPrincipal) await fijarPrincipalDireccion(tx, terceroId, input.tipo);
    const [fila] = await tx
      .insert(tercerosDirecciones)
      .values({ terceroId, ...valoresDireccion(input) })
      .returning();
    await auditar(
      tx, ctx, empresaId, "terceros_direcciones", fila!.id,
      `${formatearRut(t.rut)} · dirección ${fila!.tipo}`, "crear", undefined, fila,
    );
    return fila!;
  });
}

export async function actualizarDireccion(
  direccionId: string,
  terceroId: string,
  empresaId: string,
  input: EditarDireccionInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const t = await terceroDe(tx, terceroId, empresaId);
    const [antes] = await tx
      .select()
      .from(tercerosDirecciones)
      .where(and(eq(tercerosDirecciones.id, direccionId), eq(tercerosDirecciones.terceroId, terceroId)));
    if (!antes) throw new Error("La dirección no existe");
    if (input.esPrincipal) await fijarPrincipalDireccion(tx, terceroId, input.tipo, direccionId);
    const [fila] = await tx
      .update(tercerosDirecciones)
      .set({ ...valoresDireccion(input), updatedAt: new Date() })
      .where(eq(tercerosDirecciones.id, direccionId))
      .returning();
    await auditar(
      tx, ctx, empresaId, "terceros_direcciones", direccionId,
      `${formatearRut(t.rut)} · dirección ${fila!.tipo}`, "editar", antes, fila,
    );
    return fila!;
  });
}

export async function eliminarDireccion(
  direccionId: string,
  terceroId: string,
  empresaId: string,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const t = await terceroDe(tx, terceroId, empresaId);
    const [fila] = await tx
      .delete(tercerosDirecciones)
      .where(and(eq(tercerosDirecciones.id, direccionId), eq(tercerosDirecciones.terceroId, terceroId)))
      .returning();
    if (!fila) throw new Error("La dirección no existe");
    await auditar(
      tx, ctx, empresaId, "terceros_direcciones", direccionId,
      `${formatearRut(t.rut)} · dirección ${fila.tipo}`, "eliminar", fila, undefined,
    );
    return fila;
  });
}

function valoresDireccion(i: CrearDireccionInput | EditarDireccionInput) {
  return {
    tipo: i.tipo,
    nombre: i.nombre ?? null,
    calle: i.calle ?? null,
    numero: i.numero ?? null,
    comuna: i.comuna ?? null,
    ciudad: i.ciudad ?? null,
    region: i.region ?? null,
    pais: i.pais,
    codigoPostal: i.codigoPostal ?? null,
    esPrincipal: i.esPrincipal,
  };
}

// ── Cuentas bancarias ────────────────────────────────────────────────────────

export function listarCuentasBancarias(terceroId: string) {
  return db
    .select()
    .from(tercerosCuentasBancarias)
    .where(eq(tercerosCuentasBancarias.terceroId, terceroId));
}

async function fijarPrincipalCuenta(tx: Tx, terceroId: string, exceptoId?: string) {
  const cond = [eq(tercerosCuentasBancarias.terceroId, terceroId)];
  if (exceptoId) cond.push(ne(tercerosCuentasBancarias.id, exceptoId));
  await tx.update(tercerosCuentasBancarias).set({ esPrincipal: false }).where(and(...cond));
}

export async function crearCuentaBancaria(
  terceroId: string,
  empresaId: string,
  input: CrearCuentaBancariaInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const t = await terceroDe(tx, terceroId, empresaId);
    if (input.esPrincipal) await fijarPrincipalCuenta(tx, terceroId);
    const [fila] = await tx
      .insert(tercerosCuentasBancarias)
      .values({ terceroId, ...valoresCuenta(input) })
      .returning();
    await auditar(
      tx, ctx, empresaId, "terceros_cuentas_bancarias", fila!.id,
      `${formatearRut(t.rut)} · cuenta ${fila!.numeroCuenta}`, "crear", undefined, fila,
    );
    return fila!;
  });
}

export async function actualizarCuentaBancaria(
  cuentaId: string,
  terceroId: string,
  empresaId: string,
  input: EditarCuentaBancariaInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const t = await terceroDe(tx, terceroId, empresaId);
    const [antes] = await tx
      .select()
      .from(tercerosCuentasBancarias)
      .where(and(eq(tercerosCuentasBancarias.id, cuentaId), eq(tercerosCuentasBancarias.terceroId, terceroId)));
    if (!antes) throw new Error("La cuenta bancaria no existe");
    if (input.esPrincipal) await fijarPrincipalCuenta(tx, terceroId, cuentaId);
    const [fila] = await tx
      .update(tercerosCuentasBancarias)
      .set({ ...valoresCuenta(input), updatedAt: new Date() })
      .where(eq(tercerosCuentasBancarias.id, cuentaId))
      .returning();
    await auditar(
      tx, ctx, empresaId, "terceros_cuentas_bancarias", cuentaId,
      `${formatearRut(t.rut)} · cuenta ${fila!.numeroCuenta}`, "editar", antes, fila,
    );
    return fila!;
  });
}

export async function eliminarCuentaBancaria(
  cuentaId: string,
  terceroId: string,
  empresaId: string,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const t = await terceroDe(tx, terceroId, empresaId);
    const [fila] = await tx
      .delete(tercerosCuentasBancarias)
      .where(and(eq(tercerosCuentasBancarias.id, cuentaId), eq(tercerosCuentasBancarias.terceroId, terceroId)))
      .returning();
    if (!fila) throw new Error("La cuenta bancaria no existe");
    await auditar(
      tx, ctx, empresaId, "terceros_cuentas_bancarias", cuentaId,
      `${formatearRut(t.rut)} · cuenta ${fila.numeroCuenta}`, "eliminar", fila, undefined,
    );
    return fila;
  });
}

function valoresCuenta(i: CrearCuentaBancariaInput | EditarCuentaBancariaInput) {
  return {
    bancoId: i.bancoId,
    tipoCuenta: i.tipoCuenta,
    numeroCuenta: i.numeroCuenta,
    titular: i.titular ?? null,
    rutTitular: i.rutTitular ? normalizarRut(i.rutTitular) : null,
    esPrincipal: i.esPrincipal,
  };
}
