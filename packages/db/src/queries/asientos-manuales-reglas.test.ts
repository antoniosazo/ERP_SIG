import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { anularAsientoSchema, asientoManualSchema, puedeEditarFinanzas, totalesAsiento, validarFiltrosAsientos } from "@erp/shared";
import { periodoAdmiteAsientoManual, resolverLineasAsiento, validarLibro, type MaestrosAsiento } from "./asientos-manuales-reglas";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const cuenta = (n: number, extras: Record<string, unknown> = {}) => ({
  id: id(n),
  codigoCuenta: `1.1.${n}`,
  nombreCuenta: `Cuenta ${n}`,
  activa: true,
  nivelImputable: true,
  tipoCuenta: "Otra",
  requiereCentroCosto: false,
  requiereAnalisisTerceros: false,
  modoMoneda: "Funcional",
  ...extras,
});
const maestros = (): MaestrosAsiento => ({
  cuentas: new Map([
    [id(1), cuenta(1)],
    [id(2), cuenta(2)],
    [id(3), cuenta(3, { tipoCuenta: "Cliente" })],
    [id(4), cuenta(4, { requiereCentroCosto: true })],
    [id(5), cuenta(5, { nivelImputable: false })],
    [id(6), cuenta(6, { modoMoneda: "Extranjera fija" })],
  ]),
  terceros: new Map([
    [id(20), { id: id(20), razonSocial: "Cliente SpA", activo: true }],
    [id(21), { id: id(21), razonSocial: "Sin cuenta Ltda", activo: true }],
  ]),
  centrosCosto: new Map([[id(30), { id: id(30), codigo: "ADM", estado: "Activo" }]]),
  cuentaDeTercero: new Map([
    [id(20), id(3)],
    [id(21), null],
  ]),
});
const linea = (extras: Record<string, unknown>) => ({ debe: 0, haber: 0, ...extras });

describe("asientos manuales: líneas", () => {
  test("usa la cuenta asociada cuando solo se indica el socio (Código SN de SAP)", () => {
    const [l] = resolverLineasAsiento([linea({ terceroId: id(20), debe: 100 })], maestros(), "Glosa");
    assert.equal(l!.cuentaId, id(3));
    assert.equal(l!.terceroId, id(20));
  });
  test("propaga la glosa de la cabecera a las líneas sin glosa", () => {
    const [a, b] = resolverLineasAsiento(
      [linea({ cuentaId: id(1), debe: 10 }), linea({ cuentaId: id(2), haber: 10, glosa: "propia" })],
      maestros(),
      "Cabecera",
    );
    assert.equal(a!.glosa, "Cabecera");
    assert.equal(b!.glosa, "propia");
  });
  test("exige socio en cuentas de control y centro de costo cuando la cuenta lo pide", () => {
    assert.throws(() => resolverLineasAsiento([linea({ cuentaId: id(3), debe: 1 })], maestros(), "g"), /es de control/);
    assert.throws(() => resolverLineasAsiento([linea({ cuentaId: id(4), debe: 1 })], maestros(), "g"), /exige centro de costo/);
    assert.doesNotThrow(() => resolverLineasAsiento([linea({ cuentaId: id(4), centroCostoId: id(30), debe: 1 })], maestros(), "g"));
  });
  test("rechaza cuentas de título, en moneda extranjera o de otra empresa", () => {
    assert.throws(() => resolverLineasAsiento([linea({ cuentaId: id(5), debe: 1 })], maestros(), "g"), /no imputable/);
    assert.throws(() => resolverLineasAsiento([linea({ cuentaId: id(6), debe: 1 })], maestros(), "g"), /moneda extranjera/);
    assert.throws(() => resolverLineasAsiento([linea({ cuentaId: id(99), debe: 1 })], maestros(), "g"), /no existe en esta empresa/);
    assert.throws(() => resolverLineasAsiento([linea({ terceroId: id(99), debe: 1 })], maestros(), "g"), /socio de negocio no existe/);
  });
  test("avisa cuando el socio no tiene cuenta asociada", () => {
    assert.throws(() => resolverLineasAsiento([linea({ terceroId: id(21), debe: 1 })], maestros(), "g"), /no tiene cuenta asociada/);
  });
});

describe("asientos manuales: cabecera y cuadratura", () => {
  const base = {
    fecha: "2026-09-30",
    glosa: "Provisión",
    lineas: [linea({ cuentaId: id(1), debe: 100 }), linea({ cuentaId: id(2), haber: 99.99 })],
  };
  test("un borrador puede quedar descuadrado; al contabilizar se exige debe = haber", () => {
    assert.equal(asientoManualSchema.safeParse(base).success, true);
    const r = asientoManualSchema.safeParse({ ...base, contabilizar: true });
    assert.equal(r.success, false);
    assert.match(r.error!.issues[0]!.message, /no cuadra/);
  });
  test("cada línea lleva debe o haber, no ambos ni ninguno", () => {
    const ambos = asientoManualSchema.safeParse({ ...base, lineas: [linea({ cuentaId: id(1), debe: 1, haber: 1 }), base.lineas[1]] });
    const cero = asientoManualSchema.safeParse({ ...base, lineas: [linea({ cuentaId: id(1) }), base.lineas[1]] });
    assert.equal(ambos.success, false);
    assert.equal(cero.success, false);
  });
  test("la fecha de reversión debe ser posterior a la del asiento", () => {
    assert.equal(asientoManualSchema.safeParse({ ...base, fechaReversa: "2026-09-30" }).success, false);
    assert.equal(asientoManualSchema.safeParse({ ...base, fechaReversa: "2026-10-01" }).success, true);
  });
  test("totales redondean a 2 decimales y toleran medio centavo", () => {
    assert.deepEqual(totalesAsiento([{ debe: 0.1, haber: 0 }, { debe: 0.2, haber: 0 }, { debe: 0, haber: 0.3 }]), {
      debe: 0.3,
      haber: 0.3,
      diferencia: 0,
      cuadra: true,
    });
  });
  test("períodos y libro", () => {
    assert.equal(periodoAdmiteAsientoManual("Desbloqueado"), true);
    assert.equal(periodoAdmiteAsientoManual("Período de cierre"), true);
    assert.equal(periodoAdmiteAsientoManual("Bloqueado"), false);
    assert.equal(periodoAdmiteAsientoManual("Bloqueado excepto ventas"), false);
    assert.throws(() => validarLibro("IFRS", false), /doble libro/);
    assert.doesNotThrow(() => validarLibro("IFRS", true));
  });
});


describe("regresiones de validación de Finanzas", () => {
  const base = {
    fecha: "2026-09-30", glosa: "Validación",
    lineas: [linea({ cuentaId: id(1), debe: 100 }), linea({ cuentaId: id(2), haber: 100 })],
    contabilizar: true,
  };
  test("rechaza fechas imposibles, año cero y fechas de reversión inválidas", () => {
    for (const fecha of ["2026-02-29", "2026-04-31", "0000-01-01", "2026-13-01"]) {
      assert.equal(asientoManualSchema.safeParse({ ...base, fecha }).success, false);
      assert.equal(asientoManualSchema.safeParse({ ...base, fechaReversa: fecha }).success, false);
      assert.equal(anularAsientoSchema.safeParse({ fecha, motivo: "Corrección" }).success, false);
    }
    assert.equal(asientoManualSchema.safeParse({ ...base, fecha: "2024-02-29" }).success, true);
  });
  test("no contabiliza líneas que se convertirían en cero al redondear", () => {
    const lineas = [linea({ cuentaId: id(1), debe: 0.001 }), linea({ cuentaId: id(2), haber: 0.001 })];
    assert.equal(asientoManualSchema.safeParse({ ...base, lineas }).success, false);
  });
  test("rechaza precisión extra, negativos, infinitos y desbordamientos", () => {
    for (const monto of [1.005, -1, Infinity, NaN, 1e15]) {
      assert.equal(asientoManualSchema.safeParse({ ...base, lineas: [linea({ cuentaId: id(1), debe: monto }), linea({ cuentaId: id(2), haber: monto })] }).success, false);
    }
    assert.equal(asientoManualSchema.safeParse({ ...base, lineas: [linea({ cuentaId: id(1), debe: 0.29 }), linea({ cuentaId: id(2), haber: 0.29 })] }).success, true);
  });
  test("rechaza totales fuera de la precisión segura aunque las líneas sean válidas", () => {
    const lineas = Array.from({ length: 4 }, (_, i) => linea({ cuentaId: id(1), debe: i < 2 ? 60_000_000_000_000 : 0, haber: i >= 2 ? 60_000_000_000_000 : 0 }));
    assert.equal(asientoManualSchema.safeParse({ ...base, lineas }).success, false);
    assert.equal(asientoManualSchema.safeParse({ ...base, lineas, contabilizar: false }).success, false);
  });
  test("suma centavos sin diferencias por representación binaria", () => {
    const lineas = Array.from({ length: 499 }, () => ({ debe: 0.01, haber: 0 }));
    lineas.push({ debe: 0, haber: 4.99 });
    assert.deepEqual(totalesAsiento(lineas), { debe: 4.99, haber: 4.99, diferencia: 0, cuadra: true });
  });
  test("valida filtros repetidos y rangos invertidos antes de consultar la base", () => {
    for (const params of [
      { hasta: "2026-02-30" }, { desde: "2026-10-01", hasta: "2026-09-30" },
      { hasta: ["2026-09-30", "2026-10-01"] }, { q: ["a", "b"] },
      { estado: ["borrador", "contabilizado"] }, { origen: "inexistente" }, { q: "x".repeat(201) },
    ]) assert.equal(validarFiltrosAsientos(params, "2026-09-30").success, false);
    const r = validarFiltrosAsientos({ hasta: "2024-02-29", estado: "", origen: "" }, "2026-09-30");
    assert.equal(r.success, true);
    if (r.success) assert.equal(r.data.desde, "2024-02-01");
  });
  test("solo los roles de edición y el administrador de firma pueden escribir", () => {
    for (const rol of ["Administrador", "Contador"]) assert.equal(puedeEditarFinanzas(false, rol), true);
    for (const rol of ["Consulta", "Auditor", null]) assert.equal(puedeEditarFinanzas(false, rol), false);
    assert.equal(puedeEditarFinanzas(true, null), true);
  });
  test("rechaza maestros inactivos y centros de costo de otra empresa", () => {
    const m = maestros();
    assert.throws(() => resolverLineasAsiento([linea({ cuentaId: id(4), centroCostoId: id(99), debe: 1 })], m, "g"), /no existe en esta empresa/);
    assert.throws(() => resolverLineasAsiento([linea({ cuentaId: id(1), debe: 1 })], { ...m, cuentas: new Map([[id(1), cuenta(1, { activa: false })]]) }, "g"), /inactiva/);
    assert.throws(() => resolverLineasAsiento([linea({ cuentaId: id(1), terceroId: id(20), debe: 1 })], { ...m, terceros: new Map([[id(20), { id: id(20), razonSocial: "Inactivo", activo: false }]]) }, "g"), /inactivo/);
    assert.throws(() => resolverLineasAsiento([linea({ cuentaId: id(4), centroCostoId: id(30), debe: 1 })], { ...m, centrosCosto: new Map([[id(30), { id: id(30), codigo: "ADM", estado: "Inactivo" }]]) }, "g"), /inactivo/);
  });
});


test("el detalle de automáticos conserva los cuatro decimales antes de sumar", () => {
  assert.deepEqual(totalesAsiento([{ debe: 0.004, haber: 0 }, { debe: 0.004, haber: 0.008 }]), {
    debe: 0.01, haber: 0.01, diferencia: 0, cuadra: true,
  });
});
