import assert from "node:assert/strict";
import test from "node:test";
import { assertIndexCoverage, enumerateMonths, IndexCoverageError } from "../src/services/index-coverage-service.js";

test("enumera todas as competências inclusivas", () => {
  assert.deepEqual(enumerateMonths("2026-01-15", "2026-03-20").map((date) => date.toISOString().slice(0, 7)), ["2026-01", "2026-02", "2026-03"]);
});

test("bloqueia cálculo quando uma competência não foi publicada", async () => {
  const repository = { findMissingPeriods: async () => [new Date("2026-02-01T00:00:00.000Z")] };
  await assert.rejects(() => assertIndexCoverage({ repository, slug: "ipca", startDate: "2026-01-01", endDate: "2026-03-01" }), IndexCoverageError);
});
