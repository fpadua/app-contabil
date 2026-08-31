import assert from "node:assert/strict";
import test from "node:test";
import { accumulateSeriesFactors, applyAccumulatedFactor } from "../src/index.js";

test("REGRA-CM-001 aplica o fator acumulado e arredonda em centavos", () => {
  assert.equal(applyAccumulatedFactor(1_000_000, 1.097519), 1_097_519);
});

test("REGRA-CM-001 rejeita principal inválido", () => {
  assert.throws(() => applyAccumulatedFactor(0, 1.1), TypeError);
});

test("REGRA-CM-001 acumula fatores mensais em série", () => {
  const { accumulatedFactor, perMonth } = accumulateSeriesFactors([
    { referenceDate: "2023-01-01", factor: 1.0055 },
    { referenceDate: "2023-02-01", factor: 1.0076 },
    { referenceDate: "2023-03-01", factor: 1.0056 },
  ]);
  assert.equal(perMonth.length, 3);
  assert.ok(Math.abs(accumulatedFactor - 1.0055 * 1.0076 * 1.0056) < 1e-12);
  assert.ok(Math.abs(perMonth[0].accumulatedFactor - 1.0055) < 1e-12);
  assert.ok(Math.abs(perMonth[2].accumulatedFactor - accumulatedFactor) < 1e-12);
});

test("REGRA-CM-001 rejeita série vazia ou fator inválido", () => {
  assert.throws(() => accumulateSeriesFactors([]), TypeError);
  assert.throws(() => accumulateSeriesFactors([{ referenceDate: "2023-01-01", factor: 0 }]), TypeError);
  assert.throws(() => accumulateSeriesFactors("2023-01-01"), TypeError);
});
