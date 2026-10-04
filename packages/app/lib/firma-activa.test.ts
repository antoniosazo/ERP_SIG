import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { crearFirmaActiva, verificarFirmaActiva, VIGENCIA_FIRMA_ACTIVA_SEG } from "./firma-activa";

const secretoOriginal = process.env.AUTH_SECRET;
before(() => { process.env.AUTH_SECRET = "secreto-solo-para-pruebas-de-firma-activa"; });
after(() => {
  if (secretoOriginal === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = secretoOriginal;
});

test("la firma elegida solo sirve al usuario que la eligió", () => {
  const cookie = crearFirmaActiva("usuario-a", "firma-1", 1_000);
  assert.equal(verificarFirmaActiva(cookie, "usuario-a", 2_000), "firma-1");
  assert.equal(verificarFirmaActiva(cookie, "usuario-b", 2_000), null);
});

test("rechaza cookies manipuladas, vencidas o vacías", () => {
  const cookie = crearFirmaActiva("usuario-a", "firma-1", 1_000);
  assert.equal(verificarFirmaActiva(`${cookie}x`, "usuario-a", 2_000), null);
  assert.equal(verificarFirmaActiva(cookie, "usuario-a", 1_000 + VIGENCIA_FIRMA_ACTIVA_SEG * 1_000), null);
  assert.equal(verificarFirmaActiva("", "usuario-a", 2_000), null);
  assert.equal(verificarFirmaActiva(undefined, "usuario-a", 2_000), null);
  // Cambiar la firma dentro del valor invalida la firma criptográfica.
  const [cuerpo, sello] = cookie.split(".");
  const otro = Buffer.from(Buffer.from(cuerpo!, "base64url").toString().replace("firma-1", "firma-2")).toString("base64url");
  assert.equal(verificarFirmaActiva(`${otro}.${sello}`, "usuario-a", 2_000), null);
});

test("una cookie del formato anterior (v1) ya no vale", () => {
  const payload = `v1:usuario-a:origen:firma-1:${Date.now() + 100_000}`;
  assert.equal(verificarFirmaActiva(`${Buffer.from(payload).toString("base64url")}.xx`, "usuario-a"), null);
});
