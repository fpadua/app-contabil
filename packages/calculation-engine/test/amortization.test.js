import assert from "node:assert/strict";
import test from "node:test";
import { sacSchedule, sacIndexedSchedule, priceSchedule, priceIndexedSchedule } from "../src/index.js";

test("REGRA-SAC-001 núcleo: amortização constante e juros sobre saldo", () => {
  const rows = sacSchedule({ principalInCents: 100_000, monthlyInterestRate: 0.01, months: 4 });
  assert.deepEqual(rows.map((row) => row.installmentInCents), [26_000, 25_750, 25_500, 25_250]);
  assert.deepEqual(rows.map((row) => row.remainingInCents), [75_000, 50_000, 25_000, 0]);
  assert.equal(rows.reduce((sum, row) => sum + row.installmentInCents, 0), 102_500);
});

test("REGRA-SAC-002 com correção mensal pelo índice", () => {
  const rows = sacIndexedSchedule({
    principalInCents: 100_000,
    monthlyInterestRate: 0.01,
    monthlyStats: [
      { referenceDate: "2023-01-01T00:00:00.000Z", factor: 1.0 },
      { referenceDate: "2023-02-01T00:00:00.000Z", factor: 1.02 },
    ],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].installmentInCents, 51_000);
  assert.equal(rows[1].installmentInCents, 51_510);
  assert.equal(rows[1].remainingInCents, 0);
  assert.equal(rows.reduce((sum, row) => sum + row.installmentInCents, 0), 102_510);
});

test("REGRA-PRICE-001 núcleo: prestação constante por tabela Price", () => {
  const rows = priceSchedule({ principalInCents: 100_000, monthlyInterestRate: 0.01, months: 4 });
  assert.equal(rows[0].interestInCents, 1_000);
  assert.equal(rows[0].amortizationInCents, 24_628);
  assert.equal(rows[2].amortizationInCents, 25_123);
  assert.equal(rows[3].installmentInCents, 25_629);
  assert.equal(rows[3].remainingInCents, 0);
});

test("REGRA-PRICE-001 com prestação corrigida pelo índice", () => {
  const rows = priceIndexedSchedule({
    principalInCents: 100_000,
    monthlyInterestRate: 0.01,
    monthlyStats: [
      { referenceDate: "2023-01-01T00:00:00.000Z", factor: 1.0 },
      { referenceDate: "2023-02-01T00:00:00.000Z", factor: 1.02 },
    ],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].installmentInCents, 50_751);
  assert.equal(rows[1].remainingInCents, 0);
  assert.equal(rows[0].remainingInCents, 50_249);
});

test("regras de amortização rejeitam entradas inválidas", () => {
  assert.throws(() => sacSchedule({ principalInCents: 0, monthlyInterestRate: 0.01, months: 4 }), TypeError);
  assert.throws(() => priceSchedule({ principalInCents: 100_000, monthlyInterestRate: -0.01, months: 4 }), TypeError);
  assert.throws(() => sacIndexedSchedule({ principalInCents: 100_000, monthlyInterestRate: 0.01, monthlyStats: [] }), TypeError);
});