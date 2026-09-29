import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  anularDocumentoCompraSchema,
  codigoSiiPermitidoParaCompra,
  guardarDocumentoCompraSchema,
} from "@erp/shared";

const UUID = "00000000-0000-4000-8000-000000000001";
const UUID_BASE = "00000000-0000-4000-8000-000000000002";
const BASE = {
  docTipo: "factura" as const,
  modalidad: "Servicio" as const,
  terceroId: UUID,
  tipoDocumentoId: UUID,
  folio: "100",
  fechaEmision: "2026-09-29",
  fechaVencimiento: "2026-10-29",
  fechaContabilizacion: "2026-09-29",
  monedaId: UUID,
  tipoCambio: 1,
  descuentoGlobalPct: 0,
  lineas: [{
    glosa: "Servicio mensual",
    cuentaImputacionId: UUID,
    cantidad: 1,
    precioUnitario: 100,
    descuentoLineaPct: 0,
    esExento: true,
  }],
};

describe("documentos de compra: reglas tributarias", () => {
  test("cada tipo acepta solo sus códigos SII", () => {
    assert.equal(codigoSiiPermitidoParaCompra("factura", "33"), true);
    assert.equal(codigoSiiPermitidoParaCompra("factura", "34"), true);
    assert.equal(codigoSiiPermitidoParaCompra("factura", "HON"), true);
    assert.equal(codigoSiiPermitidoParaCompra("factura", "61"), false);
    assert.equal(codigoSiiPermitidoParaCompra("nota_credito", "61"), true);
    assert.equal(codigoSiiPermitidoParaCompra("nota_credito", "56"), false);
    assert.equal(codigoSiiPermitidoParaCompra("nota_debito", "56"), true);
  });

  test("la factura exige folio y tipo de cambio positivo", () => {
    assert.equal(guardarDocumentoCompraSchema.safeParse(BASE).success, true);
    assert.equal(guardarDocumentoCompraSchema.safeParse({ ...BASE, folio: "" }).success, false);
    assert.equal(guardarDocumentoCompraSchema.safeParse({ ...BASE, tipoCambio: 0 }).success, false);
  });

  test("la nota exige una factura de referencia", () => {
    const nota = { ...BASE, docTipo: "nota_credito" as const };
    assert.equal(guardarDocumentoCompraSchema.safeParse(nota).success, false);
    assert.equal(
      guardarDocumentoCompraSchema.safeParse({ ...nota, documentoBaseId: UUID_BASE }).success,
      true,
    );
  });

  test("el vencimiento no puede ser anterior a la emisión", () => {
    const resultado = guardarDocumentoCompraSchema.safeParse({
      ...BASE,
      fechaVencimiento: "2026-09-28",
    });
    assert.equal(resultado.success, false);
  });

  test("un servicio exige descripción en cada línea", () => {
    const resultado = guardarDocumentoCompraSchema.safeParse({
      ...BASE,
      lineas: [{ ...BASE.lineas[0], glosa: "" }],
    });
    assert.equal(resultado.success, false);
  });

  test("la anulación exige fecha y motivo", () => {
    assert.equal(
      anularDocumentoCompraSchema.safeParse({
        motivo: "Error de registro",
        fechaReversa: "2026-09-29",
      }).success,
      true,
    );
    assert.equal(
      anularDocumentoCompraSchema.safeParse({ motivo: "", fechaReversa: "2026-09-29" }).success,
      false,
    );
    assert.equal(anularDocumentoCompraSchema.safeParse({ motivo: "Error" }).success, false);
  });
});
