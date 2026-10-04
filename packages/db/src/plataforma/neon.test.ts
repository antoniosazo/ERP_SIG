import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, test } from "node:test";
import { cifrarConexiones, descifrar, descifrarConexiones } from "./cripto";
import { crearProyectoNeon, REGION_NEON_POR_DEFECTO } from "./neon";

const fetchOriginal = globalThis.fetch;
const entorno = { ...process.env };

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
}

const proyectoCreado = {
  project: { id: "proyecto-prueba-123", region_id: "aws-sa-east-1" },
  connection_uris: [
    {
      connection_parameters: {
        host: "ep-prueba.sa-east-1.aws.neon.tech",
        pooler_host: "ep-prueba-pooler.sa-east-1.aws.neon.tech",
        database: "neondb",
        role: "neondb_owner",
        password: "p@ss/word",
      },
    },
  ],
};

describe("cliente de Neon", () => {
  beforeEach(() => {
    process.env.NEON_API_KEY = "key-de-prueba";
    process.env.NEON_ORG_ID = "org-prueba-1";
    delete process.env.NEON_REGION;
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    process.env = { ...entorno };
  });

  test("crea el proyecto en São Paulo con Postgres 18 en la organización y arma ambas conexiones", async () => {
    let pedido: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      pedido = { url, init };
      return respuesta(201, proyectoCreado);
    }) as typeof fetch;

    const p = await crearProyectoNeon({ nombre: "ERP Firma de Prueba" });

    assert.equal(pedido!.url, "https://console.neon.tech/api/v2/projects");
    assert.equal(pedido!.init.method, "POST");
    assert.equal((pedido!.init.headers as Record<string, string>).Authorization, "Bearer key-de-prueba");
    const cuerpo = JSON.parse(String(pedido!.init.body));
    assert.deepEqual(cuerpo.project, { name: "ERP Firma de Prueba", region_id: REGION_NEON_POR_DEFECTO, pg_version: 18, org_id: "org-prueba-1" });
    assert.equal(p.proyectoId, "proyecto-prueba-123");
    assert.equal(p.baseDatos, "neondb");
    assert.equal(p.conexiones.app, "postgresql://neondb_owner:p%40ss%2Fword@ep-prueba-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=verify-full");
    assert.equal(p.conexiones.directa, "postgresql://neondb_owner:p%40ss%2Fword@ep-prueba.sa-east-1.aws.neon.tech/neondb?sslmode=verify-full");
  });

  test("reintenta ante límites de tasa y fallas del servidor", async () => {
    let llamadas = 0;
    globalThis.fetch = (async () => {
      llamadas++;
      return llamadas < 3 ? respuesta(llamadas === 1 ? 429 : 503, { message: "ocupado" }) : respuesta(201, proyectoCreado);
    }) as unknown as typeof fetch;
    const p = await crearProyectoNeon({ nombre: "ERP Reintento" });
    assert.equal(llamadas, 3);
    assert.equal(p.proyectoId, "proyecto-prueba-123");
  });

  test("no reintenta errores del pedido y muestra el mensaje de Neon", async () => {
    let llamadas = 0;
    globalThis.fetch = (async () => {
      llamadas++;
      return respuesta(404, { message: "not an organization member" });
    }) as unknown as typeof fetch;
    await assert.rejects(() => crearProyectoNeon({ nombre: "ERP Org mala" }), /Neon respondió 404: not an organization member/);
    assert.equal(llamadas, 1);
  });

  test("exige la API key y la organización", async () => {
    delete process.env.NEON_ORG_ID;
    globalThis.fetch = (async () => respuesta(201, proyectoCreado)) as unknown as typeof fetch;
    await assert.rejects(() => crearProyectoNeon({ nombre: "ERP" }), /NEON_ORG_ID no está definida/);
  });
});

describe("cifrado de conexiones", () => {
  beforeEach(() => {
    process.env.FIRMAS_CONEXION_KEY = randomBytes(32).toString("base64");
  });
  afterEach(() => {
    process.env = { ...entorno };
  });

  test("ida y vuelta, sin dejar la contraseña en claro", () => {
    const c = { app: "postgresql://u:secreto@pooler/db", directa: "postgresql://u:secreto@host/db" };
    const blob = cifrarConexiones(c);
    assert.ok(!blob.includes("secreto"));
    assert.deepEqual(descifrarConexiones(blob), c);
  });

  test("rechaza un blob alterado o descifrado con otra clave", () => {
    const blob = cifrarConexiones({ app: "a", directa: "b" });
    const [iv, tag, ct] = blob.split(":");
    const alterado = `${iv}:${tag}:${Buffer.from("otro texto").toString("base64")}`;
    assert.throws(() => descifrar(alterado));
    process.env.FIRMAS_CONEXION_KEY = randomBytes(32).toString("base64");
    assert.throws(() => descifrar(blob));
    assert.ok(ct);
  });
});
