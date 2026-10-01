import assert from "node:assert/strict";
import { test } from "node:test";
import { disponerGrafo, TARJETA, type NodoMapaDTO } from "./mapa-grafo";

const nodo = (clave: string, fecha: string): NodoMapaDTO => ({
  clave, tabla: "documentos_compra", id: clave, tipo: clave, numero: clave, estado: null, fecha, monto: null,
  pagoTipo: null, anio: null, raiz: false, href: null,
});
const a = (desde: string, hasta: string, tipo: "base" | "pago" | "asiento" = "base") => ({ desde, hasta, tipo, detalle: null });

test("la cadena queda de izquierda a derecha y en línea recta", () => {
  const d = disponerGrafo({
    nodos: [nodo("fac", "2026-01-10"), nodo("oc", "2026-01-01"), nodo("ent", "2026-01-05")],
    aristas: [a("oc", "ent"), a("ent", "fac")],
  });
  const p = (c: string) => d.posiciones.get(c)!;
  assert.deepEqual(["oc", "ent", "fac"].map((c) => p(c).capa), [0, 1, 2]);
  assert.equal(p("oc").y, p("ent").y);
  assert.equal(p("ent").y, p("fac").y);
  assert.ok(p("oc").x < p("ent").x && p("ent").x < p("fac").x);
  assert.equal(d.flechas.length, 2);
});

test("los documentos de una misma etapa no se superponen", () => {
  const d = disponerGrafo({
    nodos: [nodo("fac", "2026-01-10"), nodo("pago", "2026-02-01"), nodo("asiento", "2026-01-10"), nodo("nc", "2026-01-20")],
    aristas: [a("fac", "pago", "pago"), a("fac", "asiento", "asiento"), a("fac", "nc")],
  });
  const ys = ["pago", "asiento", "nc"].map((c) => d.posiciones.get(c)!.y).sort((x, y) => x - y);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i]! - ys[i - 1]! >= TARJETA.alto);
});

test("un nodo con dos antecedentes queda a la derecha de ambos", () => {
  const d = disponerGrafo({
    nodos: [nodo("e1", "2026-01-01"), nodo("e2", "2026-01-02"), nodo("fac", "2026-01-10")],
    aristas: [a("e1", "fac"), a("e2", "fac")],
  });
  assert.equal(d.posiciones.get("fac")!.capa, 1);
  assert.equal(d.flechas.length, 2);
});

test("tolera ciclos, bucles y aristas a nodos desconocidos", () => {
  const d = disponerGrafo({
    nodos: [nodo("x", "2026-01-01"), nodo("y", "2026-01-02")],
    aristas: [a("x", "y"), a("y", "x"), a("x", "x"), a("y", "fantasma")],
  });
  assert.equal(d.posiciones.size, 2);
  assert.ok(d.flechas.every((f) => d.posiciones.get(f.desde)!.capa < d.posiciones.get(f.hasta)!.capa));
});

test("un documento solo ocupa una tarjeta", () => {
  const d = disponerGrafo({ nodos: [nodo("solo", "2026-01-01")], aristas: [] });
  assert.equal(d.posiciones.size, 1);
  assert.equal(d.flechas.length, 0);
});
