import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { crearCuentaSchema, fechasConsultaCuenta, puedeEditarPlanCuentas, rangoConsultaCuentaSchema, type CrearCuentaInput } from "@erp/shared";
import { planificarCuenta, validarMonedaCuenta } from "./plan-cuentas-reglas";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const datos = (overrides: Partial<CrearCuentaInput> = {}) => crearCuentaSchema.parse({
  codigoCuenta: "1", nombreCuenta: "Activo", clase: "Activo", naturaleza: "Deudora", ...overrides,
});
const cuenta = (n: number, codigo: string, padre: number | null, extras: Partial<CrearCuentaInput> = {}) => ({
  ...datos({ codigoCuenta: codigo, ...extras }), id: id(n), cuentaPadreId: padre === null ? null : id(padre), monedaFijaId: extras.monedaFijaId ?? null,
});
const plan = [cuenta(1, "1", null), cuenta(2, "1.1", 1), cuenta(3, "1.1.1", 2), cuenta(4, "2", null, { clase: "Pasivo" })];

describe("integridad del plan de cuentas", () => {
  test("crea una raíz y hereda la clase de la raíz al crear una hija", () => {
    assert.equal(planificarCuenta(plan, datos({ codigoCuenta: "3", clase: "Patrimonio" })).clase, "Patrimonio");
    assert.equal(planificarCuenta(plan, datos({ codigoCuenta: "2.1", cuentaPadreId: id(4) })).clase, "Pasivo");
  });
  test("rechaza un padre o una cuenta que no pertenecen al plan recibido", () => {
    assert.throws(() => planificarCuenta(plan, datos({ codigoCuenta: "9.1", cuentaPadreId: id(99) })), /no existe en esta empresa/);
    assert.throws(() => planificarCuenta(plan, datos(), id(99)), /no existe en esta empresa/);
  });
  test("valida el prefijo y un único segmento por nivel también en servidor", () => {
    for (const codigoCuenta of ["9.1", "1.", "1.1.7"]) {
      assert.throws(() => planificarCuenta(plan, datos({ codigoCuenta, cuentaPadreId: id(1) })), /El código debe ser/);
    }
  });
  test("impide crear códigos duplicados", () => {
    assert.throws(() => planificarCuenta(plan, datos({ codigoCuenta: "1.1", cuentaPadreId: id(1) })), /Ya existe/);
  });
  test("las principales rechazan cualquier edición, incluso de atributos secundarios", () => {
    const cambios: Partial<CrearCuentaInput>[] = [
      {}, { codigoCuenta: "9" }, { nombreCuenta: "Otro nombre" }, { cuentaPadreId: id(4) },
      { clase: "Ingresos" }, { naturaleza: "Acreedora" }, { tipoCuenta: "Banco" },
      { clasificacionCorriente: "Corriente" }, { nivelImputable: false },
      { requiereCentroCosto: true }, { requiereAnalisisTerceros: true },
      { modoMoneda: "Cualquiera" }, { monedaFijaId: id(20) },
      { relevanteFlujoCaja: true }, { esCuentaAjuste: true }, { activa: false },
    ];
    for (const cambio of cambios) {
      assert.throws(() => planificarCuenta(plan, datos(cambio), id(1)), /principales.*solo lectura/);
    }
  });
  test("bloquea el cambio de clase de una rama si una hija tiene movimientos", () => {
    assert.throws(() => planificarCuenta(plan, datos({ codigoCuenta: "2.1", cuentaPadreId: id(4) }), id(2), new Set([id(3)])), /tiene movimientos/);
  });
  test("renumera todos los descendientes manteniendo los identificadores", () => {
    const r = planificarCuenta(plan, datos({ codigoCuenta: "1.5", cuentaPadreId: id(1) }), id(2));
    assert.deepEqual(r.cambios.map((c) => [c.id, c.codigoCuenta]), [[id(2), "1.5"], [id(3), "1.5.1"]]);
  });
  test("mover una rama hereda clase y renumera descendientes", () => {
    const r = planificarCuenta(plan, datos({ codigoCuenta: "2.1", cuentaPadreId: id(4) }), id(2));
    assert.deepEqual(r.cambios.map((c) => [c.codigoCuenta, c.clase]), [["2.1", "Pasivo"], ["2.1.1", "Pasivo"]]);
    assert.throws(() => planificarCuenta(plan, datos({ codigoCuenta: "2.1", cuentaPadreId: id(4) }), id(2), new Set([id(3)])), /tiene movimientos/);
  });
  test("bloquea la renumeración de una cuenta padre con movimientos propios, de hijas o nietas", () => {
    const profundo = [...plan, cuenta(5, "1.1.1.1", 3)];
    for (const movimiento of [2, 3, 5]) {
      assert.throws(() => planificarCuenta(profundo, datos({ codigoCuenta: "1.5", cuentaPadreId: id(1) }), id(2), new Set([id(movimiento)])), /no se puede cambiar el código/);
    }
  });
  test("bloquea mover una rama con movimientos aunque conserve la clase", () => {
    const mismoGrupo = [...plan, cuenta(5, "1.2", 1)];
    assert.throws(() => planificarCuenta(mismoGrupo, datos({ codigoCuenta: "1.2.1", cuentaPadreId: id(5) }), id(2), new Set([id(3)])), /no se puede cambiar el código, la cuenta padre ni la clase/);
  });
  test("rechaza cambiar la clase enviada de un padre protegido aunque se herede la original", () => {
    assert.throws(() => planificarCuenta(plan, datos({ codigoCuenta: "1.1", cuentaPadreId: id(1), clase: "Pasivo" }), id(2), new Set([id(3)])), /ni la clase/);
  });
  test("permite cambiar el nombre de un padre con movimientos sin alterar su estructura", () => {
    const r = planificarCuenta(plan, datos({ codigoCuenta: "1.1", cuentaPadreId: id(1), nombreCuenta: "Activo corriente" }), id(2), new Set([id(2), id(3)]));
    assert.deepEqual(r.cambios.map((c) => [c.id, c.codigoCuenta, c.clase]), [[id(2), "1.1", "Activo"], [id(3), "1.1.1", "Activo"]]);
    assert.equal(plan[1]!.nombreCuenta, "Activo", "el cálculo no muta el árbol original");
  });
  test("permite crear subcuentas de principales y padres protegidos", () => {
    assert.equal(planificarCuenta(plan, datos({ codigoCuenta: "1.2", cuentaPadreId: id(1) }), undefined, new Set([id(3)])).clase, "Activo");
    assert.equal(planificarCuenta(plan, datos({ codigoCuenta: "1.1.2", cuentaPadreId: id(2) }), undefined, new Set([id(3)])).clase, "Activo");
  });
  test("conserva las reglas de edición de una cuenta de detalle con movimientos", () => {
    assert.equal(planificarCuenta(plan, datos({ codigoCuenta: "1.1.5", cuentaPadreId: id(2), nombreCuenta: "Detalle actualizado" }), id(3), new Set([id(3)])).cambios[0]!.codigoCuenta, "1.1.5");
  });
  test("detecta colisiones en un código descendiente antes de escribir", () => {
    const conConflicto = [...plan, cuenta(9, "1.5.1", 4)];
    assert.throws(() => planificarCuenta(conConflicto, datos({ codigoCuenta: "1.5", cuentaPadreId: id(1) }), id(2)), /Ya existe.*1.5.1/);
  });
  test("rechaza renumeraciones que exceden el largo en las hijas", () => {
    assert.throws(() => planificarCuenta(plan, datos({ codigoCuenta: `1.${"5".repeat(28)}`, cuentaPadreId: id(1) }), id(2)), /30 caracteres/);
  });
  test("rechaza ciclos y protege la posición de las cuentas principales", () => {
    assert.throws(() => planificarCuenta(plan, datos({ codigoCuenta: "1.1.1.1", cuentaPadreId: id(3) }), id(2)), /descendiente/);
    assert.throws(() => planificarCuenta(plan, datos({ cuentaPadreId: id(4) }), id(1)), /principales/);
  });
  test("respeta los cuatro niveles tanto al crear como al mover una rama", () => {
    const profundo = [...plan, cuenta(5, "1.1.1.1", 3)];
    assert.throws(() => planificarCuenta(profundo, datos({ codigoCuenta: "1.1.1.1.1", cuentaPadreId: id(5) })), /4 niveles/);
    const otroArbol = [...profundo, cuenta(6, "2.1", 4), cuenta(7, "2.1.1", 6)];
    assert.throws(() => planificarCuenta(otroArbol, datos({ codigoCuenta: "2.1.1.1", cuentaPadreId: id(7) }), id(2)), /4 niveles/);
  });
  test("la moneda fija queda inmutable con movimientos", () => {
    const extranjera = cuenta(8, "1.2", 1, { modoMoneda: "Extranjera fija", monedaFijaId: id(20) });
    const input = datos({ codigoCuenta: "1.2", cuentaPadreId: id(1), modoMoneda: "Extranjera fija", monedaFijaId: id(21) });
    assert.throws(() => planificarCuenta([...plan, extranjera], input, id(8), new Set([id(8)])), /no se puede cambiar la moneda/);
    assert.equal(planificarCuenta([...plan, extranjera], input, id(8)).monedaFijaId, id(21));
  });
  test("mantiene bloqueados modo de moneda y control de terceros con movimientos", () => {
    for (const cambio of [{ modoMoneda: "Cualquiera" as const }, { requiereAnalisisTerceros: true }]) {
      assert.throws(() => planificarCuenta(plan, datos({ codigoCuenta: "1.1", cuentaPadreId: id(1), ...cambio }), id(2), new Set([id(2)])), /no se puede cambiar/);
    }
  });
  test("solo admite monedas propias, no ajenas ni de plantilla", () => {
    for (const moneda of [undefined, { id: id(20), empresaId: id(99) }, { id: id(20), empresaId: null }]) {
      assert.throws(() => validarMonedaCuenta(id(20), id(10), moneda), /no pertenece/);
    }
    assert.doesNotThrow(() => validarMonedaCuenta(id(20), id(10), { id: id(20), empresaId: id(10) }));
  });
});

describe("fechas de consulta", () => {
  const hoy = "2026-09-28";
  test("usa hoy y enero del mismo año solo cuando se omiten los parámetros", () => {
    assert.deepEqual(fechasConsultaCuenta({}, hoy), { desde: "2026-01-01", hasta: hoy, error: null });
    assert.equal(fechasConsultaCuenta({ hasta: "2024-12-31" }, hoy).desde, "2024-01-01");
  });
  test("acepta un día bisiesto válido", () => {
    assert.equal(fechasConsultaCuenta({ hasta: "2024-02-29" }, hoy).error, null);
  });
  test("rechaza fechas imposibles, vacías, repetidas y año cero", () => {
    for (const hasta of ["2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "", [hoy, hoy]]) {
      assert.ok(fechasConsultaCuenta({ hasta }, hoy).error);
    }
  });
  test("rechaza Desde posterior a Hasta y permite el mismo día", () => {
    assert.match(fechasConsultaCuenta({ desde: "2026-10-01", hasta: hoy }, hoy).error!, /posterior/);
    assert.equal(rangoConsultaCuentaSchema.safeParse({ desde: hoy, hasta: hoy }).success, true);
  });
});

test("solo administrador, contador y administrador de firma pueden editar", () => {
  for (const rol of ["Administrador", "Contador"]) assert.equal(puedeEditarPlanCuentas(false, rol), true);
  for (const rol of [null, "Consulta", "Auditor", "Otro"]) assert.equal(puedeEditarPlanCuentas(false, rol), false);
  assert.equal(puedeEditarPlanCuentas(true, null), true);
});
