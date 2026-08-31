import assert from "node:assert/strict";
import test from "node:test";
import { RefreshEconomicIndexService } from "../src/services/refresh-economic-index-service.js";

function makeRepository(overrides = {}) {
  const runs = [];
  return {
    sourceName: undefined,
    createSyncRun: async (data) => { const run = { id: `run-${runs.length + 1}`, ...data }; runs.push(run); return run; },
    finishSyncRun: async (id, data) => data,
    findBySlug: async (slug) => (overrides.findBySlug ? overrides.findBySlug(slug) : { id: `id-${slug}`, slug, name: slug.toUpperCase() }),
    upsertCatalogItem: async (item) => item,
    importValues: async ({ values, ...rest }) => ({
      inserted: values.length,
      updated: 0,
      unchanged: 0,
      failed: 0,
      _indexId: rest.economicIndexId,
    }),
    runs,
  };
}

const value = (period, monthlyValue) => ({
  referenceDate: new Date(`${period}-01T00:00:00.000Z`),
  monthlyValue,
  published: true,
});

test("refresh importa os valores de um único índice e fecha o provider", async () => {
  let closed = false;
  const repository = makeRepository();
  const provider = {
    sourceName: "Fake provider",
    getSeries: async (slug) => ({ basis: { monthlyValue: "percent" }, values: [value("2026-07", "1.10"), value("2026-08", "1.20")] }),
    close: async () => { closed = true; },
  };

  const service = new RefreshEconomicIndexService({ repository, provider });
  const result = await service.execute({ slug: "ipca", requestedBy: "tester" });

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.inserted, 2);
  assert.equal(result.updated, 0);
  assert.equal(closed, true);
  assert.equal(repository.runs[0].requestedBy, "tester");
});

test("refresh de índice inexistente retorna FAILED sem chamar o provider", async () => {
  let getSeriesCalled = false;
  const repository = makeRepository({ findBySlug: async () => null });
  const provider = {
    sourceName: "Fake provider",
    getSeries: async () => { getSeriesCalled = true; return { values: [] }; },
    close: async () => {},
  };

  const service = new RefreshEconomicIndexService({ repository, provider });
  const result = await service.execute({ slug: "fantasma" });

  assert.equal(result.status, "FAILED");
  assert.equal(result.failed, 1);
  assert.equal(getSeriesCalled, false);
  assert.match(result.errors[0], /não encontrado/i);
});

test("refresh com erro do provider retorna FAILED", async () => {
  const repository = makeRepository();
  const provider = {
    sourceName: "Fake provider",
    getSeries: async () => { throw new Error("página bloqueada"); },
    close: async () => {},
  };

  const service = new RefreshEconomicIndexService({ repository, provider });
  const result = await service.execute({ slug: "tr" });

  assert.equal(result.status, "FAILED");
  assert.match(result.errors[0], /página bloqueada/i);
});
