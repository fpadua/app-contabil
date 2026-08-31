import assert from "node:assert/strict";
import test from "node:test";
import { judicialTwoPhaseCorrection, salaryDifferenceSchedule } from "../src/index.js";

test("REGRA-JUD-001 combina fase 1 (série) com fase 2 (fator único)", () => {
  const result = judicialTwoPhaseCorrection({
    principalInCents: 100_000,
    firstPhaseStats: [
      { referenceDate: "2021-11-01T00:00:00.000Z", factor: 1.02 },
      { referenceDate: "2021-12-01T00:00:00.000Z", factor: 1.018 },
    ],
    secondPhaseAccumulatedFactor: 1.06,
  });
  assert.ok(Math.abs(result.accumulatedFactor - 1.02 * 1.018 * 1.06) < 1e-12);
  assert.equal(result.correctedInCents, 110_066);
  assert.equal(result.correctionInCents, 10_066);
  assert.equal(result.months.length, 3);
  assert.equal(result.months[0].competence, "11/2021");
  assert.equal(result.months[2].competence, "Fase Selic (a partir de 09/12/2021)");
  assert.equal(result.months[2].accumulatedFactor, result.accumulatedFactor);
});

test("REGRA-JUD-001 rejeita fase sem série ou fator inválido", () => {
  assert.throws(() => judicialTwoPhaseCorrection({ principalInCents: 100_000, firstPhaseStats: [], secondPhaseAccumulatedFactor: 1 }), TypeError);
  assert.throws(() => judicialTwoPhaseCorrection({ principalInCents: 100_000, firstPhaseStats: [{ referenceDate: "d", factor: 1.01 }], secondPhaseAccumulatedFactor: 0 }), TypeError);
});

test("REGRA-DIF-001 corrige diferenças mensais e aplica reflexos de 13º e férias", () => {
  const result = salaryDifferenceSchedule({
    monthlyDifferenceInCents: 30_000,
    monthlyStats: [
      { referenceDate: "2023-01-01T00:00:00.000Z", factor: 1.0 },
      { referenceDate: "2023-02-01T00:00:00.000Z", factor: 1.02 },
    ],
  });
  assert.deepEqual(result.months.map((month) => month.correctedInCents), [30_000, 30_600]);
  assert.equal(result.sumCorrectedInCents, 60_600);
  assert.equal(result.decimoTerceiroInCents, 5_050);
  assert.equal(result.vacationsInCents, 6_733);
  assert.equal(result.correctedInCents, 72_383);
  assert.equal(result.accumulatedFactor, 1.02);
});

test("REGRA-DIF-001 permite desligar reflexos", () => {
  const result = salaryDifferenceSchedule({
    monthlyDifferenceInCents: 30_000,
    monthlyStats: [{ referenceDate: "2023-01-01T00:00:00.000Z", factor: 1.0 }],
    reflections: { decimoTerceiro: false, vacationsWithBonus: false },
  });
  assert.equal(result.decimoTerceiroInCents, 0);
  assert.equal(result.vacationsInCents, 0);
  assert.equal(result.correctedInCents, 30_000);
});