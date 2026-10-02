import assert from "node:assert/strict";
import { test } from "node:test";
import { etiquetaEstado, pasoSiguienteCompra, resumenErrores } from "./documentos-ux";

const cab = [{ id: "folio", label: "Folio SII" }, { id: "terceroId", label: "Proveedor" }] as never;
const lin = [{ id: "cuentaImputacionId", label: "Cuenta de imputación" }, { id: "cantidad", label: "Cantidad" }] as never;

test("estados con un solo vocabulario", () => {
  assert.equal(etiquetaEstado("borrador"), "Borrador");
  assert.equal(etiquetaEstado("raro"), "raro");
});

test("resume errores de cabecera y de líneas con su nombre", () => {
  const r = resumenErrores(
    {
      folio: { type: "custom", message: "Indica el folio SII", ref: {} },
      lineas: [{ cuentaImputacionId: { message: "Requerido", ref: {} }, cantidad: { message: "Debe ser mayor a 0" } }, undefined, { cantidad: { message: "Debe ser mayor a 0" } }],
    },
    cab,
    lin,
  );
  assert.deepEqual(r, [
    "Folio SII: Indica el folio SII",
    "Línea 1 · Cuenta de imputación: Requerido",
    "Línea 1 · Cantidad: Debe ser mayor a 0",
    "Línea 3 · Cantidad: Debe ser mayor a 0",
  ]);
});

test("el error de la lista completa no se confunde con un campo", () => {
  assert.deepEqual(resumenErrores({ lineas: { message: "Agrega al menos una línea" } }, cab, lin), ["Agrega al menos una línea"]);
  assert.deepEqual(resumenErrores({}, cab, lin), []);
});

test("el siguiente paso depende del tipo y el estado", () => {
  assert.match(pasoSiguienteCompra("pedido", "borrador", true)!, /Guardar y abrir/);
  assert.match(pasoSiguienteCompra("factura", "borrador", false)!, /contabilizada al guardar/);
  assert.match(pasoSiguienteCompra("pedido", "abierto", false)!, /Continuar con/);
  assert.equal(pasoSiguienteCompra("pedido", "anulado", false), null);
});
