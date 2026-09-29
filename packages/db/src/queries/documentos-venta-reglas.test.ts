import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  anularDocumentoVentaSchema,
  codigoSiiPermitidoParaVenta,
  emitirNotaCreditoSchema,
  guardarDocumentoVentaSchema,
} from "@erp/shared";

const UUID = "00000000-0000-4000-8000-000000000001";
const BASE = {
  modalidad: "Servicio" as const,
  terceroId: UUID,
  tipoDocumentoId: UUID,
  folio: "100",
  fechaEmision: "2026-09-29",
  fechaVencimiento: "2026-09-29",
  fechaContabilizacion: "2026-09-29",
  monedaId: UUID,
  tipoCambio: 1,
  descuentoGlobalPct: 0,
  lineas: [{
    glosa: "Servicio mensual",
    cuentaIngresoId: UUID,
    cantidad: 1,
    precioUnitario: 100,
    descuentoLineaPct: 0,
    esExento: true,
  }],
};

describe("documentos de venta: reglas tributarias", () => {
  test("cada clase acepta solo sus códigos SII", () => {
    assert.equal(codigoSiiPermitidoParaVenta("Factura", "33"), true);
    assert.equal(codigoSiiPermitidoParaVenta("Factura", "34"), true);
    assert.equal(codigoSiiPermitidoParaVenta("Factura", "61"), false);
    assert.equal(codigoSiiPermitidoParaVenta("Nota de Crédito", "61"), true);
    assert.equal(codigoSiiPermitidoParaVenta("Nota de Crédito", "56"), false);
    assert.equal(codigoSiiPermitidoParaVenta("Nota de Débito", "56"), true);
  });

  test("folio y tipo de cambio positivo son obligatorios", () => {
    assert.equal(guardarDocumentoVentaSchema.safeParse(BASE).success, true);
    assert.equal(guardarDocumentoVentaSchema.safeParse({ ...BASE, folio: "" }).success, false);
    assert.equal(guardarDocumentoVentaSchema.safeParse({ ...BASE, tipoCambio: 0 }).success, false);
  });

  test("un servicio exige descripción en cada línea", () => {
    const resultado = guardarDocumentoVentaSchema.safeParse({
      ...BASE,
      lineas: [{ ...BASE.lineas[0], glosa: "" }],
    });
    assert.equal(resultado.success, false);
  });

  test("la anulación exige fecha y motivo", () => {
    assert.equal(anularDocumentoVentaSchema.safeParse({ motivo: "Error de emisión", fechaReversa: "2026-09-29" }).success, true);
    assert.equal(anularDocumentoVentaSchema.safeParse({ motivo: "", fechaReversa: "2026-09-29" }).success, false);
    assert.equal(anularDocumentoVentaSchema.safeParse({ motivo: "Error" }).success, false);
  });

  test("la nota de crédito exige un monto positivo", () => {
    const base = { facturaId: UUID, tipoDocumentoId: UUID };
    assert.equal(emitirNotaCreditoSchema.safeParse({ ...base, montoMaximo: 100 }).success, true);
    assert.equal(emitirNotaCreditoSchema.safeParse({ ...base, montoMaximo: 0 }).success, false);
  });
});
