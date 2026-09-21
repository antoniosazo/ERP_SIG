import type {
  CrearCuentaBancariaEmpresaInput,
  CrearMetodoPagoInput,
} from "@erp/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { bancos, cuentasBancarias, metodosPago, monedas, planCuentas } from "../schema";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";

// ── Cuentas bancarias de la empresa ─────────────────────────────────────────

const etiquetaCuenta = (c: { numeroCuenta: string; alias: string | null }) =>
  c.alias ? `${c.alias} (${c.numeroCuenta})` : c.numeroCuenta;

/** Cuentas bancarias propias, con banco, moneda y cuenta contable ya resueltos para mostrar. */
export async function listarCuentasBancariasEmpresa(empresaId: string) {
  return db
    .select({
      id: cuentasBancarias.id,
      bancoId: cuentasBancarias.bancoId,
      bancoNombre: bancos.nombre,
      tipoCuenta: cuentasBancarias.tipoCuenta,
      numeroCuenta: cuentasBancarias.numeroCuenta,
      alias: cuentasBancarias.alias,
      monedaId: cuentasBancarias.monedaId,
      monedaCodigo: monedas.codigo,
      cuentaContableId: cuentasBancarias.cuentaContableId,
      cuentaCodigo: planCuentas.codigoCuenta,
      cuentaNombre: planCuentas.nombreCuenta,
      activa: cuentasBancarias.activa,
    })
    .from(cuentasBancarias)
    .innerJoin(bancos, eq(bancos.id, cuentasBancarias.bancoId))
    .innerJoin(monedas, eq(monedas.id, cuentasBancarias.monedaId))
    .innerJoin(planCuentas, eq(planCuentas.id, cuentasBancarias.cuentaContableId))
    .where(eq(cuentasBancarias.empresaId, empresaId))
    .orderBy(asc(bancos.nombre), asc(cuentasBancarias.numeroCuenta));
}

/** La cuenta contable debe ser de la empresa, imputable, activa y (opcional) de ciertos tipos. */
async function validarCuentaContable(
  empresaId: string,
  cuentaId: string,
  tiposPermitidos: string[] | null,
  etiqueta: string,
) {
  const [c] = await db
    .select({
      nivelImputable: planCuentas.nivelImputable,
      activa: planCuentas.activa,
      tipoCuenta: planCuentas.tipoCuenta,
      clase: planCuentas.clase,
      codigo: planCuentas.codigoCuenta,
    })
    .from(planCuentas)
    .where(and(eq(planCuentas.id, cuentaId), eq(planCuentas.empresaId, empresaId)));
  if (!c) throw new Error(`${etiqueta}: la cuenta no pertenece a esta empresa`);
  if (!c.nivelImputable) throw new Error(`${etiqueta}: la cuenta ${c.codigo} no es imputable`);
  if (!c.activa) throw new Error(`${etiqueta}: la cuenta ${c.codigo} está inactiva`);
  if (tiposPermitidos && !tiposPermitidos.includes(c.tipoCuenta)) {
    throw new Error(`${etiqueta}: la cuenta ${c.codigo} debe ser de tipo ${tiposPermitidos.join(" o ")}`);
  }
}

async function validarCuentaBancaria(empresaId: string, input: CrearCuentaBancariaEmpresaInput) {
  const [banco] = await db.select({ id: bancos.id }).from(bancos).where(eq(bancos.id, input.bancoId));
  if (!banco) throw new Error("El banco no existe");
  const [moneda] = await db
    .select({ id: monedas.id })
    .from(monedas)
    .where(and(eq(monedas.id, input.monedaId), eq(monedas.empresaId, empresaId)));
  if (!moneda) throw new Error("La moneda no pertenece a esta empresa");
  await validarCuentaContable(empresaId, input.cuentaContableId, ["Banco"], "Cuenta contable");
}

export async function crearCuentaBancariaEmpresa(
  empresaId: string,
  input: CrearCuentaBancariaEmpresaInput,
  ctx?: AuditoriaCtx,
) {
  await validarCuentaBancaria(empresaId, input);
  return db.transaction(async (tx) => {
    const [cuenta] = await tx
      .insert(cuentasBancarias)
      .values({
        empresaId,
        bancoId: input.bancoId,
        tipoCuenta: input.tipoCuenta,
        numeroCuenta: input.numeroCuenta,
        alias: input.alias || null,
        monedaId: input.monedaId,
        cuentaContableId: input.cuentaContableId,
        activa: input.activa,
      })
      .returning();
    if (!cuenta) throw new Error("No se pudo crear la cuenta bancaria");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "cuentas_bancarias",
        registroId: cuenta.id,
        etiqueta: etiquetaCuenta(cuenta),
        accion: "crear",
        despues: cuenta,
      });
    }
    return cuenta;
  });
}

export async function actualizarCuentaBancariaEmpresa(
  cuentaId: string,
  empresaId: string,
  input: CrearCuentaBancariaEmpresaInput,
  ctx?: AuditoriaCtx,
) {
  await validarCuentaBancaria(empresaId, input);
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(cuentasBancarias)
      .where(and(eq(cuentasBancarias.id, cuentaId), eq(cuentasBancarias.empresaId, empresaId)));
    if (!antes) throw new Error("La cuenta bancaria no existe en esta empresa");
    const [cuenta] = await tx
      .update(cuentasBancarias)
      .set({
        bancoId: input.bancoId,
        tipoCuenta: input.tipoCuenta,
        numeroCuenta: input.numeroCuenta,
        alias: input.alias || null,
        monedaId: input.monedaId,
        cuentaContableId: input.cuentaContableId,
        activa: input.activa,
        updatedAt: new Date(),
      })
      .where(and(eq(cuentasBancarias.id, cuentaId), eq(cuentasBancarias.empresaId, empresaId)))
      .returning();
    if (!cuenta) throw new Error("No se pudo actualizar la cuenta bancaria");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "cuentas_bancarias",
        registroId: cuenta.id,
        etiqueta: etiquetaCuenta(cuenta),
        accion: "editar",
        antes,
        despues: cuenta,
      });
    }
    return cuenta;
  });
}

// ── Métodos de pago ─────────────────────────────────────────────────────────

/** Métodos de pago con la cuenta contable efectiva (la propia o la de su cuenta bancaria) resuelta. */
export async function listarMetodosPago(empresaId: string) {
  const rows = await db
    .select()
    .from(metodosPago)
    .where(eq(metodosPago.empresaId, empresaId))
    .orderBy(asc(metodosPago.nombre));
  const cuentasBanc = await db
    .select({ id: cuentasBancarias.id, cuentaContableId: cuentasBancarias.cuentaContableId })
    .from(cuentasBancarias)
    .where(eq(cuentasBancarias.empresaId, empresaId));
  const contableDeBanco = new Map(cuentasBanc.map((c) => [c.id, c.cuentaContableId]));
  return rows.map((m) => ({
    ...m,
    cuentaEfectivaId: m.cuentaContableId ?? (m.cuentaBancariaId ? (contableDeBanco.get(m.cuentaBancariaId) ?? null) : null),
  }));
}

async function validarMetodoPago(empresaId: string, input: CrearMetodoPagoInput) {
  if (input.cuentaBancariaId) {
    const [cb] = await db
      .select({ id: cuentasBancarias.id, activa: cuentasBancarias.activa })
      .from(cuentasBancarias)
      .where(and(eq(cuentasBancarias.id, input.cuentaBancariaId), eq(cuentasBancarias.empresaId, empresaId)));
    if (!cb) throw new Error("La cuenta bancaria no pertenece a esta empresa");
    if (!cb.activa) throw new Error("La cuenta bancaria está inactiva");
  }
  if (input.cuentaContableId) {
    // Efectivo va a Caja; el cheque recibido a una cuenta transitoria (Otra: cheques en cartera),
    // nunca directo al banco; el resto puede ir a Banco, Caja o una cuenta transitoria.
    const tipos =
      input.tipo === "Efectivo"
        ? ["Caja", "Banco"]
        : input.tipo === "Cheque" && input.sentido === "Recibido"
          ? ["Otra"]
          : ["Banco", "Caja", "Otra"];
    await validarCuentaContable(empresaId, input.cuentaContableId, tipos, "Cuenta contable");
  }
}

export async function crearMetodoPago(empresaId: string, input: CrearMetodoPagoInput, ctx?: AuditoriaCtx) {
  await validarMetodoPago(empresaId, input);
  return db.transaction(async (tx) => {
    const [metodo] = await tx
      .insert(metodosPago)
      .values({
        empresaId,
        nombre: input.nombre,
        tipo: input.tipo,
        sentido: input.sentido,
        cuentaBancariaId: input.cuentaBancariaId ?? null,
        cuentaContableId: input.cuentaContableId ?? null,
        activo: input.activo,
      })
      .returning();
    if (!metodo) throw new Error("No se pudo crear el método de pago");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "metodos_pago",
        registroId: metodo.id,
        etiqueta: metodo.nombre,
        accion: "crear",
        despues: metodo,
      });
    }
    return metodo;
  });
}

export async function actualizarMetodoPago(
  metodoId: string,
  empresaId: string,
  input: CrearMetodoPagoInput,
  ctx?: AuditoriaCtx,
) {
  await validarMetodoPago(empresaId, input);
  return db.transaction(async (tx) => {
    const [antes] = await tx
      .select()
      .from(metodosPago)
      .where(and(eq(metodosPago.id, metodoId), eq(metodosPago.empresaId, empresaId)));
    if (!antes) throw new Error("El método de pago no existe en esta empresa");
    const [metodo] = await tx
      .update(metodosPago)
      .set({
        nombre: input.nombre,
        tipo: input.tipo,
        sentido: input.sentido,
        cuentaBancariaId: input.cuentaBancariaId ?? null,
        cuentaContableId: input.cuentaContableId ?? null,
        activo: input.activo,
        updatedAt: new Date(),
      })
      .where(and(eq(metodosPago.id, metodoId), eq(metodosPago.empresaId, empresaId)))
      .returning();
    if (!metodo) throw new Error("No se pudo actualizar el método de pago");
    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "metodos_pago",
        registroId: metodo.id,
        etiqueta: metodo.nombre,
        accion: "editar",
        antes,
        despues: metodo,
      });
    }
    return metodo;
  });
}
