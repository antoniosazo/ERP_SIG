import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  calcularCuotaInmediata,
  calcularCuotaLineal,
  mesesDepreciablesHasta,
  periodoDepreciable,
  type ParametrosCuota,
} from "./activos-fijos-motor";

/**
 * Tests del motor puro de depreciación. Correr con `pnpm --filter @erp/db test`.
 * Los casos numéricos replican los ejemplos "probados contra la base de datos" de
 * `modulo-activo-fijo.md`, para que queden fijados como regresión.
 */

const base: ParametrosCuota = {
  costoDepreciable: 1_200_000,
  valorResidual: 0,
  depAcumuladaAlInicio: 0,
  vidaUtilMeses: 12,
  mesesTranscurridosAlInicio: 0,
};

/**
 * Simula la ejecución mensual tal como la hace `calcularCuotasDelPeriodo`: descarta los
 * períodos anteriores al inicio y calcula la cuota con los meses transcurridos al mes previo.
 */
function simularVida(p: {
  costo: number;
  residual: number;
  vida: number;
  fechaInicio: string;
  regla: "Inicio de mes" | "Mes siguiente";
  desde: { anio: number; mes: number };
  meses: number;
}) {
  let dep = 0;
  const cuotas: number[] = [];
  let { anio, mes } = p.desde;
  for (let i = 0; i < p.meses; i++) {
    const prev = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
    const cuota = periodoDepreciable(p.fechaInicio, p.regla, anio, mes)
      ? calcularCuotaLineal({
          costoDepreciable: p.costo,
          valorResidual: p.residual,
          depAcumuladaAlInicio: dep,
          vidaUtilMeses: p.vida,
          mesesTranscurridosAlInicio: mesesDepreciablesHasta(p.fechaInicio, p.regla, prev.anio, prev.mes),
        })
      : 0;
    cuotas.push(cuota);
    dep += cuota;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return { cuotas, dep: Math.round(dep * 100) / 100 };
}

describe("mesesDepreciablesHasta", () => {
  test("Inicio de mes: el mes de inicio cuenta como el primero", () => {
    assert.equal(mesesDepreciablesHasta("2026-03-15", "Inicio de mes", 2026, 3), 1);
    assert.equal(mesesDepreciablesHasta("2026-03-15", "Inicio de mes", 2026, 12), 10);
  });

  test("Mes siguiente: el mes de inicio no cuenta", () => {
    assert.equal(mesesDepreciablesHasta("2026-03-15", "Mes siguiente", 2026, 3), 0);
    assert.equal(mesesDepreciablesHasta("2026-03-15", "Mes siguiente", 2026, 4), 1);
  });

  test("Mes siguiente desde diciembre cruza al año siguiente", () => {
    assert.equal(mesesDepreciablesHasta("2025-12-10", "Mes siguiente", 2025, 12), 0);
    assert.equal(mesesDepreciablesHasta("2025-12-10", "Mes siguiente", 2026, 1), 1);
    assert.equal(mesesDepreciablesHasta("2025-12-10", "Mes siguiente", 2026, 12), 12);
  });

  test("cruce de varios años", () => {
    assert.equal(mesesDepreciablesHasta("2024-07-01", "Inicio de mes", 2026, 6), 24);
  });

  test("período anterior al inicio devuelve 0, nunca negativo", () => {
    assert.equal(mesesDepreciablesHasta("2026-06-01", "Inicio de mes", 2026, 1), 0);
    assert.equal(mesesDepreciablesHasta("2026-06-01", "Inicio de mes", 2025, 12), 0);
  });

  test("regla no implementada lanza error explícito", () => {
    assert.throws(() => mesesDepreciablesHasta("2026-01-01", "Prorrateo diario" as never, 2026, 1), /no implementada/);
  });
});

describe("calcularCuotaLineal", () => {
  test("$1.200.000 a 12 meses deprecia $100.000 por mes", () => {
    assert.equal(calcularCuotaLineal(base), 100_000);
  });

  test("mejora en el mes 3 recalcula sobre el remanente ($160.000, ejemplo de la guía)", () => {
    assert.equal(
      calcularCuotaLineal({ ...base, costoDepreciable: 1_800_000, depAcumuladaAlInicio: 200_000, mesesTranscurridosAlInicio: 2 }),
      160_000,
    );
  });

  test("respeta el valor residual", () => {
    assert.equal(calcularCuotaLineal({ ...base, valorResidual: 120_000 }), 90_000);
  });

  test("vida útil agotada devuelve 0", () => {
    assert.equal(calcularCuotaLineal({ ...base, mesesTranscurridosAlInicio: 12 }), 0);
    assert.equal(calcularCuotaLineal({ ...base, mesesTranscurridosAlInicio: 30 }), 0);
  });

  test("valor libro ya en o bajo el residual devuelve 0 (nunca negativo)", () => {
    assert.equal(calcularCuotaLineal({ ...base, depAcumuladaAlInicio: 1_200_000 }), 0);
    assert.equal(calcularCuotaLineal({ ...base, valorResidual: 100_000, depAcumuladaAlInicio: 1_150_000 }), 0);
  });

  test("último mes absorbe el resto: nunca excede lo depreciable", () => {
    assert.equal(
      calcularCuotaLineal({ ...base, depAcumuladaAlInicio: 1_199_999.99, mesesTranscurridosAlInicio: 11 }),
      0.01,
    );
  });

  test("régimen Acelerada ≡ lineal con vida ÷3 (36 → 12 meses) vs IFRS a 60 meses", () => {
    assert.equal(calcularCuotaLineal({ ...base, vidaUtilMeses: 36 / 3 }), 100_000);
    assert.equal(calcularCuotaLineal({ ...base, vidaUtilMeses: 60 }), 20_000);
  });

  test("vida completa con montos no divisibles cuadra exacto al costo − residual", () => {
    for (const [costo, residual, vida] of [
      [1_000_000, 0, 7],
      [999_999.99, 1, 36],
      [12_345_678, 345_678, 83],
      [100, 0, 3],
    ] as const) {
      const r = simularVida({
        costo,
        residual,
        vida,
        fechaInicio: "2026-01-01",
        regla: "Inicio de mes",
        desde: { anio: 2026, mes: 1 },
        meses: vida + 6, // meses extra: deben dar 0
      });
      assert.equal(r.dep, Math.round((costo - residual) * 100) / 100, `costo=${costo} vida=${vida}`);
      assert.ok(r.cuotas.every((c) => c >= 0));
      assert.ok(r.cuotas.slice(vida).every((c) => c === 0), "después de la vida útil no hay más cuota");
    }
  });
});

describe("calcularCuotaInmediata", () => {
  test("primer período: 100% del valor libro menos residual", () => {
    assert.equal(calcularCuotaInmediata(base), 1_200_000);
    assert.equal(calcularCuotaInmediata({ ...base, valorResidual: 1 }), 1_199_999);
  });

  test("si el primer período no se ejecutó, la cuota la toma el siguiente (no se pierde)", () => {
    assert.equal(calcularCuotaInmediata({ ...base, mesesTranscurridosAlInicio: 3 }), 1_200_000);
  });

  test("ya depreciado: 0", () => {
    assert.equal(calcularCuotaInmediata({ ...base, depAcumuladaAlInicio: 1_200_000 }), 0);
  });
});

describe("DDAN (réplica del cálculo paralelo de depreciación normal)", () => {
  test("Acelerada 12m vs Normal 36m, 9 meses: DDAN ≈ $600.000 (ejemplo de la guía)", () => {
    const acelerada = simularVida({
      costo: 1_200_000, residual: 0, vida: 12, fechaInicio: "2026-01-01", regla: "Inicio de mes",
      desde: { anio: 2026, mes: 1 }, meses: 9,
    });
    const normal = simularVida({
      costo: 1_200_000, residual: 0, vida: 36, fechaInicio: "2026-01-01", regla: "Inicio de mes",
      desde: { anio: 2026, mes: 1 }, meses: 9,
    });
    assert.equal(acelerada.dep, 900_000);
    // 1.200.000 / 36 = 33.333,33 por mes → 9 meses = 299.999,97 (la guía lo redondea a $300.000).
    assert.equal(normal.dep, 299_999.97);
    assert.equal(Math.round((acelerada.dep - normal.dep) * 100) / 100, 600_000.03);
  });
});

describe("inicio de depreciación (regresión de bugs corregidos el 2026-09-25)", () => {
  test("periodoDepreciable: falso antes del inicio y en el mes de alta con Mes siguiente", () => {
    assert.equal(periodoDepreciable("2026-03-15", "Mes siguiente", 2026, 3), false);
    assert.equal(periodoDepreciable("2026-03-15", "Mes siguiente", 2026, 4), true);
    assert.equal(periodoDepreciable("2026-03-15", "Inicio de mes", 2026, 3), true);
    assert.equal(periodoDepreciable("2026-06-01", "Inicio de mes", 2026, 5), false);
  });

  test("Mes siguiente: el mes de alta no se deprecia y la vida completa sigue cuadrando", () => {
    const r = simularVida({
      costo: 1_200_000, residual: 0, vida: 12, fechaInicio: "2026-03-15", regla: "Mes siguiente",
      desde: { anio: 2026, mes: 3 }, meses: 14,
    });
    assert.equal(r.cuotas[0], 0);
    assert.deepEqual(r.cuotas.slice(1, 13), Array(12).fill(100_000));
    assert.equal(r.cuotas[13], 0);
    assert.equal(r.dep, 1_200_000);
  });

  test("un período anterior a fechaInicioDep no se deprecia", () => {
    const r = simularVida({
      costo: 1_200_000, residual: 0, vida: 12, fechaInicio: "2026-06-01", regla: "Inicio de mes",
      desde: { anio: 2026, mes: 3 }, meses: 4,
    });
    assert.deepEqual(r.cuotas, [0, 0, 0, 100_000]);
  });
});
