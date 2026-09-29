import assert from "node:assert/strict";
import test from "node:test";
import type { Tx } from "../client";

test("la auditoría de creación identifica el asiento y resume sus líneas", async () => {
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost/test";
  const { registrarAuditoriaCreacionAsiento } = await import("./asientos");
  const respuestas = [
    [{
      id: "00000000-0000-4000-8000-000000000001",
      correlativo: 42,
      fecha: "2026-09-29",
      glosa: "Pago recibido",
      tipo: "ingreso",
      libro: "Ambos",
      estado: "contabilizado",
      origen: "pago recibido",
      documentoOrigenTabla: "pagos",
      documentoOrigenId: "00000000-0000-4000-8000-000000000002",
    }],
    [{ lineas: 3, debe: "150000.0000", haber: "150000.0000" }],
  ];
  const insertados: unknown[] = [];
  const tx = {
    select: () => ({
      from: () => ({ where: async () => respuestas.shift() }),
    }),
    insert: () => ({
      values: async (valor: unknown) => { insertados.push(valor); },
    }),
  } as unknown as Tx;

  await registrarAuditoriaCreacionAsiento(
    tx,
    "00000000-0000-4000-8000-000000000003",
    "00000000-0000-4000-8000-000000000001",
    {
      usuarioId: "00000000-0000-4000-8000-000000000004",
      usuarioNombre: "Contador Prueba",
    },
  );

  assert.equal(insertados.length, 1);
  assert.deepEqual(insertados[0], {
    empresaId: "00000000-0000-4000-8000-000000000003",
    usuarioId: "00000000-0000-4000-8000-000000000004",
    usuarioNombre: "Contador Prueba",
    tablaAfectada: "asientos_contables",
    registroId: "00000000-0000-4000-8000-000000000001",
    etiqueta: "Asiento N° 42",
    accion: "crear",
    valoresAnteriores: null,
    valoresNuevos: {
      correlativo: 42,
      fecha: "2026-09-29",
      glosa: "Pago recibido",
      tipo: "ingreso",
      libro: "Ambos",
      estado: "contabilizado",
      origen: "pago recibido",
      documentoOrigenTabla: "pagos",
      documentoOrigenId: "00000000-0000-4000-8000-000000000002",
      lineas: 3,
      totalDebe: "150000.0000",
      totalHaber: "150000.0000",
    },
    motivo: null,
  });
});
