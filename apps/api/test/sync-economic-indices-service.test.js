import assert from "node:assert/strict";
import test from "node:test";
import { SyncEconomicIndicesService } from "../src/services/sync-economic-indices-service.js";

test("sincroniza somente os índices configurados e consolida totais", async () => {
  const provider = {
    listIndices: async () => [{ slug: "ipca", name: "IPCA", periodicity: "MONTHLY", basis: null }, { slug: "ignored", name: "Ignored", periodicity: "MONTHLY", basis: null }],
    getSeries: async () => ({ basis: null, values: [{ referenceDate: new Date("2026-07-01T00:00:00.000Z"), monthlyValue: "0.07", accumulatedValue: null, accumulatedPositive: "1.0007", published: true, rawData: {} }] }),
  };
  const finished = [];
  const repository = {
    createSyncRun: async () => ({ id: "run-1" }),
    upsertCatalogItem: async (item) => ({ ...item, id: "index-1" }),
    upsertValue: async () => "inserted",
    finishSyncRun: async (_id, data) => finished.push(data),
  };
  const service = new SyncEconomicIndicesService({ provider, repository, targetSlugs: ["ipca"] });
  const result = await service.execute({ from: "2026-07", to: "2026-07" });

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.inserted, 1);
  assert.equal(finished[0].status, "SUCCEEDED");
});
