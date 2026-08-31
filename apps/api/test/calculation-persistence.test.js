import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { calculationRoutes } from "../src/routes/calculations.js";
import { saveCalculationSchema } from "../src/schemas/calculation-schema.js";

const NOT_FOUND = () => {
  const error = new Error("Record not found");
  error.code = "P2025";
  throw error;
};

const UUID_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UUID_MISSING = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const validPayload = {
  title: "Revisão contratual — Contrato 2021",
  clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  result: {
    principalInCents: 1_000_000,
    indexSlug: "ipca",
    startDate: "2023-01-01",
    endDate: "2024-05-31",
    accumulatedFactor: 1.0699512859259,
    correctedInCents: 1_069_951,
    correctionInCents: 69_951,
    traceabilityRuleId: "REGRA-CM-001",
    months: [
      { referenceDate: "2023-01-01T00:00:00.000Z", competence: "01/2023", factor: 1.0053, accumulatedFactor: 1.0053, correctedInCents: 1_005_300 },
      { referenceDate: "2023-02-01T00:00:00.000Z", competence: "02/2023", factor: 1.0084, accumulatedFactor: 1.01374452, correctedInCents: 1_013_745 },
    ],
  },
};

async function buildApp(repository) {
  const app = Fastify();
  await app.register(calculationRoutes, { prefix: "/api/calculations", repository });
  return app;
}

test("calculationRoutes: salva e lista cálculos com repositório injetado", async (t) => {
  const saved = [];
  const repository = {
    list: async () => saved,
    findById: async (id) => saved.find((item) => item.id === id) ?? null,
    create: async (data) => {
      const record = { id: UUID_1, ...data };
      saved.push(record);
      return record;
    },
    remove: async (id) => { if (id !== UUID_1) NOT_FOUND(); },
  };
  const app = await buildApp(repository);
  t.after(() => app.close());

  const created = await app.inject({ method: "POST", url: "/api/calculations", payload: validPayload });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().title, "Revisão contratual — Contrato 2021");
  assert.equal(created.json().indexSlug, "ipca");
  assert.equal(created.json().principalInCents, 1_000_000);
  assert.equal(created.json().accumulatedFactor, 1.0699512859259);
  assert.equal(created.json().traceabilityRuleId, "REGRA-CM-001");
  assert.equal(created.json().status, "Concluído");
  assert.equal(created.json().months.length, 2);

  const withDefaultTitle = await app.inject({ method: "POST", url: "/api/calculations", payload: { title: "  ", result: validPayload.result } });
  assert.equal(withDefaultTitle.statusCode, 201);
  assert.equal(withDefaultTitle.json().title, "Cálculo de correção monetária");

  const list = await app.inject({ method: "GET", url: "/api/calculations" });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().length, 2);

  const found = await app.inject({ method: "GET", url: `/api/calculations/${UUID_1}` });
  assert.equal(found.statusCode, 200);

  const missing = await app.inject({ method: "GET", url: `/api/calculations/${UUID_MISSING}` });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().code, "NOT_FOUND");

  const deleted = await app.inject({ method: "DELETE", url: `/api/calculations/${UUID_1}` });
  assert.equal(deleted.statusCode, 204);

  const deleteMissing = await app.inject({ method: "DELETE", url: `/api/calculations/${UUID_MISSING}` });
  assert.equal(deleteMissing.statusCode, 404);
});

test("calculationRoutes: recusa cálculo persistível incompleto", async (t) => {
  const app = await buildApp({ list: async () => [], findById: async () => null });
  t.after(() => app.close());

  const invalid = await app.inject({ method: "POST", url: "/api/calculations", payload: { title: "Sem resultado" } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().code, "INVALID_CALCULATION_INPUT");

  const badMonth = await app.inject({
    method: "POST",
    url: "/api/calculations",
    payload: { ...validPayload, result: { ...validPayload.result, months: [{ competence: "01/2023", factor: -1, accumulatedFactor: 1, correctedInCents: 100 }] } },
  });
  assert.equal(badMonth.statusCode, 400);
});

test("saveCalculationSchema normaliza meses nulos e aceita fator informado", () => {
  const parsed = saveCalculationSchema.safeParse({
    result: { ...validPayload.result, months: null },
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.title, "Cálculo de correção monetária");
  assert.equal(parsed.data.result.months, undefined);
});