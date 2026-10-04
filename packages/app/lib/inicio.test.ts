import assert from "node:assert/strict";
import { test } from "node:test";
import { rutaInicial, superadminSinFirma } from "./inicio";

const u = (o: Partial<Parameters<typeof rutaInicial>[0]> = {}) => ({ esSuperAdmin: false, esAdminFirma: false, firmaContableId: "", ...o });

test("el superadmin parte en Firmas hasta que entra a una", () => {
  assert.equal(rutaInicial(u({ esSuperAdmin: true, esAdminFirma: true })), "/superadmin/firmas");
  assert.equal(rutaInicial(u({ esSuperAdmin: true, esAdminFirma: true, firmaContableId: "f1" })), "/admin/firmas");
});

test("quien pertenece a varias firmas elige una antes de entrar", () => {
  assert.equal(rutaInicial(u()), "/elegir-firma");
  assert.equal(rutaInicial(u({ esAdminFirma: true })), "/elegir-firma");
});

test("con firma elegida, el admin parte en su firma y el resto en sus empresas", () => {
  assert.equal(rutaInicial(u({ esAdminFirma: true, firmaContableId: "f1" })), "/admin/firmas");
  assert.equal(rutaInicial(u({ firmaContableId: "f1" })), "/admin/empresas");
});

test("solo un superadmin sin firma elegida queda fuera de las páginas de firma", () => {
  assert.equal(superadminSinFirma(u({ esSuperAdmin: true })), true);
  assert.equal(superadminSinFirma(u({ esSuperAdmin: true, firmaContableId: "f1" })), false);
  assert.equal(superadminSinFirma(u({ esAdminFirma: true })), false);
});
