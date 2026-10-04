import assert from "node:assert/strict";
import test from "node:test";
import { buildCalculationCsv } from "../lib/calculation-export.js";

test("exportação de cálculo detalhado não grava NaN nos fatores", () => {
  const csv = buildCalculationCsv({
    title: "Diferença salarial",
    calculationType: "Diferença salarial",
    indexSlug: "ipca_e",
    startDate: "2015-11-01",
    endDate: "2016-11-29",
    principalInCents: 729129,
    accumulatedFactor: 1,
    correctedInCents: 1887512,
    months: [{ competence: "11/2015", correctionFactor: 1.379823, correctedInCents: 69225 }],
  });

  assert.ok(!csv.includes("NaN"));
  assert.match(csv, /1,379823;1,379823/);
});
