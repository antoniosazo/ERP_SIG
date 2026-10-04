import assert from "node:assert/strict";
import { test } from "node:test";
import { filtrarUsuarios } from "./usuarios-filtro";

const u = (nombre: string, email: string, estado: string, empresas: string[] = []) => ({ nombre, email, estado, asignaciones: empresas.map((empresaNombre) => ({ empresaNombre })) });
const lista = [
  u("María Ñuñoa", "maria@firma.cl", "Activo", ["Los Juanitos"]),
  u("Pedro Soto", "psoto@firma.cl", "Invitado"),
  u("Ana Pérez", "ana@firma.cl", "Suspendido", ["Sazo Asociados", "Empresa Segura"]),
];

test("busca sin distinguir mayúsculas ni tildes, en nombre, email y empresas", () => {
  assert.deepEqual(filtrarUsuarios(lista, { texto: "MARIA", estado: "todos" }).map((x) => x.nombre), ["María Ñuñoa"]);
  assert.deepEqual(filtrarUsuarios(lista, { texto: "nunoa", estado: "todos" }).length, 1);
  assert.deepEqual(filtrarUsuarios(lista, { texto: "psoto@", estado: "todos" }).map((x) => x.nombre), ["Pedro Soto"]);
  assert.deepEqual(filtrarUsuarios(lista, { texto: "segura", estado: "todos" }).map((x) => x.nombre), ["Ana Pérez"]);
});

test("combina texto y estado, y sin criterios devuelve todos", () => {
  assert.equal(filtrarUsuarios(lista, { texto: "", estado: "todos" }).length, 3);
  assert.deepEqual(filtrarUsuarios(lista, { texto: "", estado: "Suspendido" }).map((x) => x.nombre), ["Ana Pérez"]);
  assert.equal(filtrarUsuarios(lista, { texto: "firma.cl", estado: "Invitado" }).length, 1);
  assert.equal(filtrarUsuarios(lista, { texto: "zzz", estado: "todos" }).length, 0);
});
