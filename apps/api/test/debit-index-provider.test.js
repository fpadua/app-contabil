import assert from "node:assert/strict";
import test from "node:test";
import { DebitIndexProvider } from "../src/providers/debit-index-provider.js";

test("mapeia catálogo e série mensal da Debit API", async () => {
  const responses = [
    { data: [{ slug: "ipca", name: "IPCA", periodicity: "monthly" }] },
    { basis: { factorField: "accumulatedPositive" }, data: [{ reference: "2026-07", value: 0.07, accumulatedPositive: 1.0007, published: true }] },
  ];
  const fetchImpl = async () => ({ ok: true, json: async () => responses.shift(), headers: new Headers() });
  const provider = new DebitIndexProvider({ baseUrl: "https://example.test/v1", apiKey: "test-key", fetchImpl });

  const catalog = await provider.listIndices();
  const series = await provider.getSeries("ipca", { from: "2026-07", to: "2026-07" });

  assert.equal(catalog[0].slug, "ipca");
  assert.equal(series.values[0].monthlyValue, "0.07");
  assert.equal(series.values[0].referenceDate.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.deepEqual(series.basis, { factorField: "accumulatedPositive" });
});
