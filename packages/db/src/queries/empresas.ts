import type {
  CrearEmpresaInput,
  EditarEmpresaInput,
  EditarVisualizacionInput,
} from "@erp/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../client";
import { empresas, monedas, periodosContables, planCuentas } from "../schema";
import { empresaTieneAsientos } from "./asientos";
import { registrarAuditoria, type AuditoriaCtx } from "./auditoria";
import { clonarImpuestos } from "./impuestos";
import { clonarMonedas } from "./monedas";
import { clonarPlanDeCuentas } from "./plan-cuentas";
import {
  sembrarSeriesCompra,
  sembrarSeriesProducto,
  sembrarSeriesTercero,
  sembrarSeriesVenta,
} from "./series";
import { rangoDelMes } from "./periodos";

/**
 * Proceso 0 — Alta de empresa cliente: inserta la empresa, clona sus monedas y su plan
 * de cuentas desde las plantillas elegidas, y abre el primer periodo contable. Todo en
 * una transacción: si algún clonado falla, la empresa tampoco queda creada.
 *
 * `monedaFuncionalId` / `monedaReporteId` del input son ids de **monedas plantilla**
 * (las que muestra el formulario de alta). Se inserta la empresa apuntando a la
 * plantilla, se clonan las monedas a la lista propia de la empresa, y se repunta la
 * moneda funcional/reporte a la copia recién creada.
 */
export async function crearEmpresaConInicializacion(
  input: CrearEmpresaInput,
  ctx?: AuditoriaCtx,
) {
  return db.transaction(async (tx) => {
    const idsMonedaPlantilla = [
      input.monedaFuncionalId,
      ...(input.monedaReporteId ? [input.monedaReporteId] : []),
    ];
    const monedasPlantilla = await tx
      .select({ id: monedas.id, codigo: monedas.codigo })
      .from(monedas)
      .where(and(isNull(monedas.empresaId), inArray(monedas.id, idsMonedaPlantilla)));
    const codigoDe = (id: string) => monedasPlantilla.find((m) => m.id === id)?.codigo;

    const codigoFuncional = codigoDe(input.monedaFuncionalId);
    if (!codigoFuncional) throw new Error("La moneda funcional seleccionada no es una plantilla válida");
    const codigoReporte = input.monedaReporteId ? codigoDe(input.monedaReporteId) : null;
    if (input.monedaReporteId && !codigoReporte) {
      throw new Error("La moneda de reporte seleccionada no es una plantilla válida");
    }

    const [empresa] = await tx
      .insert(empresas)
      .values({
        firmaContableId: input.firmaContableId,
        rut: input.rut,
        razonSocial: input.razonSocial,
        giro: input.giro,
        direccion: input.direccion,
        regimenTributario: input.regimenTributario,
        fechaInicioActividades: input.fechaInicioActividades,
        monedaFuncionalId: input.monedaFuncionalId,
        monedaReporteId: input.monedaReporteId,
        permiteMultimoneda: input.permiteMultimoneda,
        aplicaIfrs: input.aplicaIfrs,
        planCuentasPlantillaId: input.planCuentasPlantillaId,
        fechaPrimerPeriodoContable: input.fechaPrimerPeriodoContable,
        estado: input.estado,
      })
      .returning();

    if (!empresa) throw new Error("No se pudo crear la empresa");

    const mapaMonedas = await clonarMonedas(tx, empresa.id);
    await tx
      .update(empresas)
      .set({
        monedaFuncionalId: mapaMonedas.get(codigoFuncional)!,
        monedaReporteId: codigoReporte ? mapaMonedas.get(codigoReporte)! : null,
      })
      .where(eq(empresas.id, empresa.id));

    await clonarImpuestos(tx, empresa.id);
    await sembrarSeriesTercero(tx, empresa.id);
    await sembrarSeriesVenta(tx, empresa.id);
    await sembrarSeriesProducto(tx, empresa.id);
    await sembrarSeriesCompra(tx, empresa.id);

    await clonarPlanDeCuentas(tx, input.planCuentasPlantillaId, empresa.id);

    const { anio, mes, fechaInicio, fechaFin } = rangoDelMes(input.fechaPrimerPeriodoContable);
    await tx.insert(periodosContables).values({
      empresaId: empresa.id,
      anio,
      mes,
      fechaInicio,
      fechaFin,
      estado: "Bloqueado",
    });

    if (ctx) {
      await registrarAuditoria(tx, {
        empresaId: empresa.id,
        ctx,
        tabla: "empresas",
        registroId: empresa.id,
        etiqueta: empresa.razonSocial,
        accion: "crear",
        despues: { ...empresa, monedaFuncionalId: mapaMonedas.get(codigoFuncional) },
      });
    }

    return empresa;
  });
}

export async function listarEmpresas() {
  return db.select().from(empresas).orderBy(asc(empresas.razonSocial));
}

export async function listarEmpresasDeFirma(firmaContableId: string) {
  return db
    .select()
    .from(empresas)
    .where(eq(empresas.firmaContableId, firmaContableId))
    .orderBy(asc(empresas.razonSocial));
}

export async function obtenerEmpresa(empresaId: string) {
  const [empresa] = await db.select().from(empresas).where(eq(empresas.id, empresaId));
  return empresa ?? null;
}

/**
 * Edición de los "Detalles de la empresa" (Módulo 4.9-A). El `where` exige también
 * `firmaContableId` para que una firma no pueda editar una empresa de otra firma
 * aunque conozca el UUID. `monedaReporteId` ausente => se limpia a null.
 */
export async function actualizarEmpresa(
  empresaId: string,
  firmaContableId: string,
  input: EditarEmpresaInput,
  ctx?: AuditoriaCtx,
) {
  const actual = await obtenerEmpresa(empresaId);
  if (
    actual &&
    input.monedaFuncionalId !== actual.monedaFuncionalId &&
    (await empresaTieneAsientos(empresaId))
  ) {
    throw new Error(
      "No se puede cambiar la moneda funcional: la empresa ya tiene transacciones contables registradas.",
    );
  }

  return db.transaction(async (tx) => {
    const [empresa] = await tx
      .update(empresas)
      .set({
        razonSocial: input.razonSocial,
        giro: input.giro,
        direccion: input.direccion ?? null,
        regimenTributario: input.regimenTributario,
        fechaInicioActividades: input.fechaInicioActividades || null,
        monedaFuncionalId: input.monedaFuncionalId,
        monedaReporteId: input.monedaReporteId ?? null,
        permiteMultimoneda: input.permiteMultimoneda,
        aplicaIfrs: input.aplicaIfrs,
        estado: input.estado,
        updatedAt: new Date(),
      })
      .where(and(eq(empresas.id, empresaId), eq(empresas.firmaContableId, firmaContableId)))
      .returning();
    if (!empresa) {
      throw new Error("No se pudo actualizar la empresa (no existe o no pertenece a la firma)");
    }
    if (ctx && actual) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "empresas",
        registroId: empresaId,
        etiqueta: empresa.razonSocial,
        accion: "editar",
        antes: actual,
        despues: empresa,
      });
    }
    return empresa;
  });
}

/** Configuración de "Visualización" (separadores y decimales). `where` con firmaContableId. */
export async function actualizarVisualizacionEmpresa(
  empresaId: string,
  firmaContableId: string,
  input: EditarVisualizacionInput,
  ctx?: AuditoriaCtx,
) {
  const actual = await obtenerEmpresa(empresaId);
  if (
    actual &&
    input.decimalesTipoCambio !== actual.decimalesTipoCambio &&
    (await empresaTieneAsientos(empresaId))
  ) {
    throw new Error(
      "No se pueden cambiar los decimales del tipo de cambio: la empresa ya tiene transacciones contables registradas.",
    );
  }

  return db.transaction(async (tx) => {
    const [empresa] = await tx
      .update(empresas)
      .set({
        separadorDecimal: input.separadorDecimal,
        separadorMiles: input.separadorMiles,
        decimalesTipoCambio: input.decimalesTipoCambio,
        updatedAt: new Date(),
      })
      .where(and(eq(empresas.id, empresaId), eq(empresas.firmaContableId, firmaContableId)))
      .returning();
    if (!empresa) {
      throw new Error("No se pudo actualizar la empresa (no existe o no pertenece a la firma)");
    }
    if (ctx && actual) {
      await registrarAuditoria(tx, {
        empresaId,
        ctx,
        tabla: "empresas",
        registroId: empresaId,
        etiqueta: `${empresa.razonSocial} · Visualización`,
        accion: "editar",
        antes: {
          separadorDecimal: actual.separadorDecimal,
          separadorMiles: actual.separadorMiles,
          decimalesTipoCambio: actual.decimalesTipoCambio,
        },
        despues: {
          separadorDecimal: empresa.separadorDecimal,
          separadorMiles: empresa.separadorMiles,
          decimalesTipoCambio: empresa.decimalesTipoCambio,
        },
      });
    }
    return empresa;
  });
}

export async function obtenerEmpresaConDetalle(empresaId: string) {
  const [empresa] = await db.select().from(empresas).where(eq(empresas.id, empresaId));
  if (!empresa) return null;

  const [cuentas, periodos] = await Promise.all([
    db
      .select()
      .from(planCuentas)
      .where(eq(planCuentas.empresaId, empresaId))
      .orderBy(asc(planCuentas.codigoCuenta)),
    db
      .select()
      .from(periodosContables)
      .where(eq(periodosContables.empresaId, empresaId))
      .orderBy(asc(periodosContables.anio), asc(periodosContables.mes)),
  ]);

  return { empresa, cuentas, periodos };
}
