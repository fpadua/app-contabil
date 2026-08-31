import assert from "node:assert/strict";
import test from "node:test";
import { SyncEconomicIndicesService } from "../src/services/sync-economic-indices-service.js";

test("sincroniza somente os índices configurados, reporta progresso por índice e consolida totais", async () => {
  const progress = [];
  const provider = {
    listIndices: async () => [{ slug: "ipca", name: "IPCA", periodicity: "MONTHLY", basis: null }, { slug: "ignored", name: "Ignored", periodicity: "MONTHLY", basis: null }],
    getSeries: async (slug) => ({
      basis: null,
      values: [{ referenceDate: new Date("2026-07-01T00:00:00.000Z"), monthlyValue: "0.07", accumulatedValue: null, accumulatedPositive: "1.0007", published: true, rawData: {} }],
    }),
  };
  const finished = [];
  const repository = {
    createSyncRun: async () => ({ id: "run-1" }),
    upsertCatalogItem: async (item) => ({ ...item, id: "index-1" }),
    importValues: async ({ values }) => {
      assert.ok(values.length > 0);
      return { inserted: 1, updated: 0, unchanged: 0 };
    },
    finishSyncRun: async (_id, data) => finished.push(data),
  };
  const service = new SyncEconomicIndicesService({ provider, repository, targetSlugs: ["ipca"] });
  const result = await service.execute({ from: "2026-07", to: "2026-07", onProgress: (patch) => progress.push(patch) });

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.inserted, 1);
  assert.equal(finished[0].status, "SUCCEEDED");

  const stages = progress.filter((p) => p.stage === "coletando" || p.stage === "concluido");
  assert.ok(stages.some((p) => p.stage === "coletando" && p.current === 1 && p.total === 1), "deve reportar 1 de 1 durante a coleta");
  assert.ok(stages.some((p) => p.stage === "concluido" && p.current === 1 && p.total === 1), "deve reportar 1 de 1 ao concluir");
  assert.equal(progress.at(-1).progress, 100);
});

test("sync ignora índices ausentes do catálogo e registra falha sem excluir os presentes", async () => {
  const provider = {
    listIndices: async () => [{ slug: "ipca", name: "IPCA", periodicity: "MONTHLY", basis: null }],
    getSeries: async () => ({ basis: null, values: [] }),
  };
  const finished = [];
  const repository = {
    createSyncRun: async () => ({ id: "run-1" }),
    upsertCatalogItem: async (item) => ({ ...item, id: "index-1" }),
    importValues: async () => ({ inserted: 0, updated: 0, unchanged: 0 }),
    finishSyncRun: async (_id, data) => finished.push(data),
  };
  const service = new SyncEconomicIndicesService({ provider, repository, targetSlugs: ["ipca", "inpc"] });
  const result = await service.execute({});

  assert.equal(result.status, "FAILED");
  assert.ok(result.errors.some((e) => e.includes("inpc")), "deve reportar Índices ausentes para inpc");
  assert.equal(finished[0].status, "FAILED");
});
