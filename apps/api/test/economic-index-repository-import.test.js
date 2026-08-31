import assert from "node:assert/strict";
import test from "node:test";
import { EconomicIndexRepository } from "../src/repositories/economic-index-repository.js";

function makeDatabase() {
  const valueStore = new Map();
  const historyStore = [];
  const database = {
    economicIndexValue: {
      findMany: async ({ where }) => Array.from(valueStore.values()).filter((value) => value.economicIndexId === where.economicIndexId),
      createMany: async ({ data }) => { for (const item of data) valueStore.set(item.referenceDate.toISOString().slice(0, 7), item); return { count: data.length }; },
      update: async ({ where, data }) => {
        const key = Object.values(where.economicIndexId_referenceDate)[1].toISOString().slice(0, 7);
        const merged = { ...valueStore.get(key), ...data };
        valueStore.set(key, merged);
        return merged;
      },
    },
    economicIndexValueHistory: { createMany: async ({ data }) => { historyStore.push(...data); return { count: data.length }; } },
  };
  return { database, historyStore };
}

const value = (monthKey, monthlyValue) => ({
  referenceDate: new Date(`${monthKey}-01T00:00:00.000Z`),
  monthlyValue,
  accumulatedValue: null,
  accumulatedPositive: null,
  published: true,
});

test("importValues classifica valores novos, alterados e inalterados sem interactive transaction", async () => {
  const { database, historyStore } = makeDatabase();
  database.economicIndexValue.createMany({ data: [
    { economicIndexId: "i1", ...value("2026-06", "1.12"), sourceUrl: "x" },
    { economicIndexId: "i1", ...value("2026-07", "1.20"), sourceUrl: "x" },
  ] });

  const repository = new EconomicIndexRepository(database);
  const totals = await repository.importValues({
    economicIndexId: "i1",
    syncRunId: "run-1",
    values: [
      value("2026-06", "1.12"),       // unchanged
      value("2026-07", "1.22"),       // updated (1.20 -> 1.22)
      value("2026-08", "1.30"),       // inserted
    ],
  });

  assert.deepEqual(totals, { inserted: 1, updated: 1, unchanged: 1, failed: 0 });

  const month = async (key) => (await database.economicIndexValue.findMany({ where: { economicIndexId: "i1" } })).find((v) => v.referenceDate.toISOString().slice(0, 7) === key);
  assert.equal((await month("2026-07")).monthlyValue, "1.22");
  assert.equal((await month("2026-08")).monthlyValue, "1.30");

  const histories = historyStore.filter((h) => h.syncRunId === "run-1");
  assert.equal(histories.length, 2);
  const updatedHistory = histories.find((h) => h.referenceDate.toISOString().slice(0, 7) === "2026-07");
  assert.equal(updatedHistory.previousMonthlyValue, "1.20");
  assert.equal(updatedHistory.newMonthlyValue, "1.22");
});
