import assert from "node:assert/strict";
import test from "node:test";
import { ImportEconomicIndexService } from "../src/services/import-economic-index-service.js";
import { PdfIndexImportError } from "../src/services/pdf-index-parser.js";

function fakeParser(values) {
  return {
    parse: async () => ({
      name: "Selic (Bacen)",
      values,
    }),
  };
}

test("importa Ã­ndice a partir do PDF, marca origem IMPORTED e consolida totais", async () => {
  const values = [
    { referenceDate: new Date("2026-06-01T00:00:00.000Z"), monthlyValue: "1.12", rawData: [{ value: "1,12", year: 2026 }] },
    { referenceDate: new Date("2026-07-01T00:00:00.000Z"), monthlyValue: "1.22", rawData: [{ value: "1,22", year: 2026 }] },
  ];
  const created = [];
  const finished = [];
  const repository = {
    upsertCatalogItem: async (item) => { assert.equal(item.origin, "IMPORTED"); return { ...item, id: "index-1" }; },
    createSyncRun: async (data) => { created.push(data); return { id: "run-1" }; },
    importValues: async ({ values }) => ({ inserted: values.length, updated: 0, unchanged: 0, failed: 0 }),
    finishSyncRun: async (_id, data) => finished.push(data),
  };
  const service = new ImportEconomicIndexService({ repository, parser: fakeParser(values) });
  const result = await service.execute({ pdf: new Uint8Array([1, 2, 3]) });

  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.inserted, 2);
  assert.equal(result.index.origin, "IMPORTED");
  assert.equal(result.index.slug, "selic_bacen");
  assert.equal(created[0].source, "PDF import: Selic (Bacen)");
  assert.equal(created[0].fromPeriod, "2026-06");
  assert.equal(created[0].toPeriod, "2026-07");
  assert.equal(finished[0].status, "SUCCEEDED");
});

test("aceita slug, nome e fonte informados pelo usuÃ¡rio", async () => {
  const values = [{ referenceDate: new Date("2026-06-01T00:00:00.000Z"), monthlyValue: "1.12", rawData: [] }];
  const repository = {
    upsertCatalogItem: async (item) => item,
    createSyncRun: async () => ({ id: "run-1" }),
    importValues: async ({ values }) => ({ inserted: values.length, updated: 0, unchanged: 0, failed: 0 }),
    finishSyncRun: async () => {},
  };
  const service = new ImportEconomicIndexService({
    repository,
    parser: fakeParser(values),
  });
  const result = await service.execute({
    slug: "selic",
    name: "Selic",
    source: "Bacen",
    pdf: new Uint8Array([1, 2, 3]),
  });

  assert.equal(result.index.slug, "selic");
  assert.equal(result.index.name, "Selic");
  assert.equal(result.index.source, "Bacen");
});

test("falha quando o PDF nÃ£o contÃ©m nenhum valor", async () => {
  const repository = {
    upsertCatalogItem: async () => ({}),
    createSyncRun: async () => ({}),
    importValues: async () => ({ inserted: 0, updated: 0, unchanged: 0, failed: 0 }),
    finishSyncRun: async () => {},
  };
  const service = new ImportEconomicIndexService({ repository, parser: fakeParser([]) });
  await assert.rejects(() => service.execute({ pdf: new Uint8Array([1, 2, 3]) }), PdfIndexImportError);
});

test("reporta o progresso ao chamador via onProgress", async () => {
  const values = [{ referenceDate: new Date("2026-06-01T00:00:00.000Z"), monthlyValue: "1.12", rawData: [] }];
  const repository = {
    upsertCatalogItem: async () => ({ id: "index-1" }),
    createSyncRun: async () => ({ id: "run-1" }),
    importValues: async ({ values }) => ({ inserted: values.length, updated: 0, unchanged: 0, failed: 0 }),
    finishSyncRun: async () => {},
  };
  const calls = [];
  const service = new ImportEconomicIndexService({ repository, parser: fakeParser(values) });
  await service.execute({ pdf: new Uint8Array([1, 2, 3]), onProgress: (patch) => calls.push(patch) });

  assert.ok(calls.length >= 2, "onProgress deve ser chamado mais de uma vez");
  assert.equal(calls[0].progress, 0);
  assert.equal(calls[calls.length - 1].progress, 100);
  assert.ok(calls.every((call) => typeof call.message === "string"));
});
