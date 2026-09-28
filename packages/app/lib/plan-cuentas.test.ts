// Ejecutar: pnpm --filter @erp/db exec tsx --test ../app/lib/plan-cuentas.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFormControl } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { crearCuentaSchema } from "@erp/shared";
import { descendientesCuenta, filtrarPlanCuentas, valoresDe } from "./plan-cuentas-vista";
import { siguienteCodigoHijo } from "./plan-cuentas-codigo";
import type { CuentaLite } from "@/components/panel/cuenta-form-dialog";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const cuenta = (n: number, codigo: string, padre: number | null, extras: Partial<CuentaLite> = {}): CuentaLite => ({
  ...crearCuentaSchema.parse({ codigoCuenta: codigo, nombreCuenta: "Activo", clase: "Activo", naturaleza: "Deudora" }),
  id: id(n), cuentaPadreId: padre === null ? null : id(padre), monedaFijaId: null, ...extras,
});
const plan = [
  cuenta(1, "1", null, { nivelImputable: false }),
  cuenta(2, "1.1", 1, { nivelImputable: false, activa: false }),
  cuenta(3, "1.1.1", 2, { nombreCuenta: "Máquinas" }),
  cuenta(4, "2", null, { nombreCuenta: "Pasivo", clase: "Pasivo", nivelImputable: false }),
];

for (const padre of [null, plan[1]!]) {
  test(`crear ${padre ? "hija" : "raíz"} pasa el resolver con el código automático`, async () => {
    const form = createFormControl({ resolver: zodResolver(crearCuentaSchema), defaultValues: valoresDe(plan, null, padre) });
    form.setValue("nombreCuenta", "Cuenta nueva");
    let enviado = false;
    await form.handleSubmit((data) => {
      enviado = true;
      assert.equal(data.codigoCuenta, padre ? "1.1.2" : "3");
    }, (errors) => assert.fail(JSON.stringify(errors)))();
    assert.equal(enviado, true);
  });
}

test("cambiar el padre actualiza el código antes de validar", async () => {
  const form = createFormControl({ resolver: zodResolver(crearCuentaSchema), defaultValues: valoresDe(plan, null) });
  form.setValue("nombreCuenta", "Cuenta nueva");
  form.setValue("cuentaPadreId", id(2));
  form.setValue("codigoCuenta", siguienteCodigoHijo(plan[1]!, plan));
  await form.handleSubmit((data) => assert.equal(data.codigoCuenta, "1.1.2"), (errors) => assert.fail(JSON.stringify(errors)))();
});

test("editar conserva los datos protegidos de una cuenta raíz", async () => {
  const form = createFormControl({ resolver: zodResolver(crearCuentaSchema), defaultValues: valoresDe(plan, plan[0]!) });
  await form.handleSubmit((data) => {
    assert.equal(data.codigoCuenta, "1");
    assert.equal(data.nombreCuenta, "Activo");
  }, (errors) => assert.fail(JSON.stringify(errors)))();
});

test("busca sin tildes y conserva ancestros aunque no coincidan con los filtros", () => {
  const r = filtrarPlanCuentas(plan, "maquinas", "activas", "imputables");
  assert.deepEqual([...r.coincidencias], [id(3)]);
  assert.deepEqual(new Set(r.visibles), new Set([id(1), id(2), id(3)]));
});

test("filtra cuentas inactivas y títulos; permite limpiar y muestra búsqueda vacía", () => {
  assert.deepEqual([...filtrarPlanCuentas(plan, "", "inactivas", "titulos").coincidencias], [id(2)]);
  assert.equal(filtrarPlanCuentas(plan, "", "todas", "todas").coincidencias.size, 4);
  assert.equal(filtrarPlanCuentas(plan, "inexistente", "todas", "todas").visibles.size, 0);
});

test("identifica toda la rama para excluir padres descendientes", () => {
  assert.deepEqual([...descendientesCuenta(plan, id(1))], [id(1), id(2), id(3)]);
});
