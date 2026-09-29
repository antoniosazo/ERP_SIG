import assert from "node:assert/strict";
import { test } from "node:test";
import { rutaOrigen } from "./origen-asiento";
import { referenciaDeLinea, rutaListaAsientos, rutaReferenciaAsiento } from "./asientos-navegacion";

const base = "/panel/empresa";
test("documentos, cheques y activos abren el registro exacto", () => {
  for (const [tabla, destino] of [
    ["documentos_compra", "compras/documentos"], ["documentos_venta", "ventas/documentos"],
    ["depositos", "tesoreria/depositos"], ["cheques", "tesoreria/cheques"],
    ["activos_fijos_documentos", "activos-fijos/documentos"], ["asientos_contables", "contabilidad/asientos"],
  ]) assert.equal(rutaReferenciaAsiento("empresa", { id: "registro", tabla: tabla!, etiqueta: "Documento" }), `${base}/${destino}/registro`);
});
test("el cierre abre el ejercicio correcto y no adivina un año faltante", () => {
  assert.equal(rutaReferenciaAsiento("empresa", { id: "registro", tabla: "cierres_ejercicio", etiqueta: "Cierre", anio: 2024 }), `${base}/configuracion/cierre-ejercicio?anio=2024`);
  assert.equal(rutaReferenciaAsiento("empresa", { id: "registro", tabla: "cierres_ejercicio", etiqueta: "Cierre" }), null);
});
test("pagos diferencian cobro y pago; tipos desconocidos no generan enlaces", () => {
  const m = { origenTabla: "pagos", origenId: "pago", pagoTipo: "Recibido" };
  assert.equal(rutaOrigen("empresa", m), `${base}/tesoreria/pagos-recibidos/pago`);
  assert.equal(rutaOrigen("empresa", { ...m, pagoTipo: "Efectuado" }), `${base}/tesoreria/pagos-efectuados/pago`);
  assert.equal(rutaOrigen("empresa", { ...m, pagoTipo: "Otro" }), null);
  assert.equal(rutaOrigen("empresa", { ...m, origenTabla: "desconocida" }), null);
});
test("no enlaza referencias inexistentes o ambiguas", () => {
  const refs = [{ id: "a", tabla: "pagos", etiqueta: "Pago" }, { id: "a", tabla: "documentos_venta", etiqueta: "Venta" }];
  assert.equal(referenciaDeLinea(refs, "a"), null);
  assert.equal(referenciaDeLinea(refs, "otra"), null);
  assert.equal(referenciaDeLinea(refs, null), null);
  assert.equal(referenciaDeLinea(refs.slice(0, 1), "a"), refs[0]);
});
test("volver al listado conserva fechas, estado, origen y búsqueda", () => {
  const filtros = new URLSearchParams({ desde: "2026-09-01", hasta: "2026-09-28", estado: "contabilizado", origen: "manual", q: "Pago & ajuste" });
  const url = rutaListaAsientos("empresa", filtros.toString(), "2026-09-28");
  assert.equal(url, `${base}/contabilidad/asientos?${filtros}`);
});
test("retorno manipulado nunca navega fuera de la empresa ni acepta fechas inválidas", () => {
  for (const entrada of [undefined, ["a", "b"], "desde=2026-02-30", "q=a&q=b", "x".repeat(1001)]) {
    assert.equal(rutaListaAsientos("empresa", entrada, "2026-09-28"), `${base}/contabilidad/asientos`);
  }
  assert.ok(rutaListaAsientos("empresa", "https://otro.example/panel/otra", "2026-09-28").startsWith(`${base}/contabilidad/asientos?`));
});
