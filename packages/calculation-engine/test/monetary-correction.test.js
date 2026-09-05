import assert from "node:assert/strict";
import test from "node:test";
import { accumulateIndexFactors, accumulateSeriesFactors, accumulateSpreadsheetIndexFactors, applyAccumulatedFactor, INDEX_ACCUMULATION_METHODS } from "../src/index.js";

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

test("REGRA-IND-001 acumula o índice regressivamente com seis casas", () => {
  const result = accumulateSpreadsheetIndexFactors([
    { referenceDate: "2021-09-01", factor: 1.0114 },
    { referenceDate: "2021-10-01", factor: 1.012 },
    { referenceDate: "2021-11-01", factor: 1.0117 },
  ]);

  assert.equal(result.accumulatedFactor, 1.035512);
  assert.deepEqual(
    result.perMonth.map(({ variation, accumulatedFactor }) => ({ variation, accumulatedFactor })),
    [
      { variation: 0.011672, accumulatedFactor: 1.035512 },
      { variation: 0.01214, accumulatedFactor: 1.02384 },
      { variation: 0.0117, accumulatedFactor: 1.0117 },
    ],
  );
});

test("REGRA-IND-001 ordena competências e valida entradas", () => {
  const result = accumulateSpreadsheetIndexFactors([
    { referenceDate: "2021-11-01", factor: 1.0117 },
    { referenceDate: "2021-10-01", factor: 1.012 },
  ]);

  assert.deepEqual(result.perMonth.map((month) => month.referenceDate), ["2021-10-01", "2021-11-01"]);
  assert.throws(() => accumulateSpreadsheetIndexFactors([]), TypeError);
  assert.throws(() => accumulateSpreadsheetIndexFactors([{ referenceDate: "inválida", factor: 1.01 }]), TypeError);
  assert.throws(() => accumulateSpreadsheetIndexFactors([{ referenceDate: "2021-11-01", factor: 0 }]), TypeError);
});

test("REGRA-IND-001 suporta índice mensal negativo", () => {
  const result = accumulateSpreadsheetIndexFactors([
    { referenceDate: "2020-04-01", factor: 0.9999 },
    { referenceDate: "2020-05-01", factor: 0.9941 },
  ]);

  assert.deepEqual(
    result.perMonth.map(({ variation, accumulatedFactor }) => ({ variation, accumulatedFactor })),
    [
      { variation: -0.000099, accumulatedFactor: 0.994001 },
      { variation: -0.0059, accumulatedFactor: 0.9941 },
    ],
  );
});

test("REGRA-IND-CORE-001 soma taxas simples de juros e Selic sem capitalizar", () => {
  const result = accumulateIndexFactors([
    { referenceDate: "2024-11-01", factor: 1.0093 },
    { referenceDate: "2024-12-01", factor: 1.0079 },
    { referenceDate: "2025-01-01", factor: 1.0093 },
  ], { method: INDEX_ACCUMULATION_METHODS.SIMPLE_RATE_BACKWARD });

  assert.equal(result.accumulatedRate, 0.0265);
  assert.equal(result.accumulatedFactor, 1.0265);
  assert.deepEqual(result.perMonth.map((month) => month.accumulatedRate), [0.0265, 0.0172, 0.0093]);
});

test("REGRA-IND-CORE-001 usa diretamente fatores oficiais já acumulados", () => {
  const result = accumulateIndexFactors([
    { referenceDate: "2019-04-01", factor: 1.007509 },
    { referenceDate: "2019-05-01", factor: 1.0015 },
  ], { method: INDEX_ACCUMULATION_METHODS.DIRECT_FACTOR });

  assert.equal(result.accumulatedFactor, 1.007509);
  assert.deepEqual(result.perMonth.map((month) => month.accumulatedFactor), [1.007509, 1.0015]);
});
