import assert from "node:assert/strict";
import test from "node:test";
import { calculateMonetaryCorrection } from "../src/services/calculation-service.js";

const noGaps = { findMissingPeriods: async () => [] };

test("REGRA-CM-001 aceita fator informado e aplica ao principal", async () => {
  const repository = { ...noGaps, findValuesBetween: async () => { throw new Error("não deve consultar a série"); } };
  const result = await calculateMonetaryCorrection({ principalInCents: 1_000_000, accumulatedFactor: 1.097519, indexSlug: "ipca", startDate: "2023-01-01", endDate: "2024-05-31" }, repository);

  assert.equal(result.correctedInCents, 1_097_519);
  assert.equal(result.correctionInCents, 97_519);
  assert.equal(result.traceabilityRuleId, "REGRA-CM-001");
  assert.equal(result.months, null);
});

test("REGRA-CM-001 calcula o fator a partir da série mensal do banco", async () => {
  const repository = {
    ...noGaps,
    findValuesBetween: async () => ({
      values: [
        { referenceDate: new Date("2023-01-01T00:00:00.000Z"), monthlyValue: "0.55", accumulatedPositive: "1.0055" },
        { referenceDate: new Date("2023-02-01T00:00:00.000Z"), monthlyValue: "0.76", accumulatedPositive: "1.0076" },
        { referenceDate: new Date("2023-03-01T00:00:00.000Z"), monthlyValue: "0.56", accumulatedPositive: "1.0056" },
      ],
    }),
  };
  const result = await calculateMonetaryCorrection({ principalInCents: 1_000_000, indexSlug: "ipca", startDate: "2023-01-15", endDate: "2023-03-31" }, repository);

  const expectedFactor = 1.0055 * 1.0076 * 1.0056;
  assert.ok(Math.abs(result.accumulatedFactor - expectedFactor) < 1e-12);
  assert.equal(result.correctedInCents, Math.round(1_000_000 * expectedFactor));
  assert.equal(result.months.length, 3);
  assert.equal(result.months[0].competence, "01/2023");
  assert.equal(result.months[0].factor, 1.0055);
  assert.equal(result.months[0].correctedInCents, 1_005_500);
  assert.equal(result.months[2].correctedInCents, result.correctedInCents);
});

test("REGRA-CM-001 usa a variação mensal quando o fator acumulado positivo não existe", async () => {
  const repository = {
    ...noGaps,
    findValuesBetween: async () => ({ values: [{ referenceDate: new Date("2023-01-01T00:00:00.000Z"), monthlyValue: "1", accumulatedPositive: null }] }),
  };
  const result = await calculateMonetaryCorrection({ principalInCents: 10_000, indexSlug: "inpc", startDate: "2023-01-01", endDate: "2023-01-31" }, repository);

  assert.ok(Math.abs(result.accumulatedFactor - 1.01) < 1e-12);
  assert.equal(result.correctedInCents, 10_100);
});