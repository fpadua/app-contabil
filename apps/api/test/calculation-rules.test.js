import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { calculationRoutes } from "../src/routes/calculations.js";
import { calculateJudicialCorrection, calculateMonetaryCorrection, calculatePrice, calculateSac, calculateSalaryDifference } from "../src/services/calculation-service.js";

const noGaps = { findMissingPeriods: async () => [] };
const series = (values) => ({ findValuesBetween: async () => ({ values }) });
const month = (referenceDate, rate, accumulatedPositive = null) => ({ referenceDate: new Date(referenceDate), monthlyValue: String(rate), accumulatedPositive: accumulatedPositive ? String(accumulatedPositive) : null });

test("REGRA-SAC-001 sem índice: amortização constante e juros sobre saldo", async () => {
  const result = await calculateSac({ principalInCents: 1_000_000, monthlyInterestRate: 0.01, months: 4, startDate: "2023-01-01", endDate: "2023-04-30" }, noGaps);
  assert.equal(result.type, "sac");
  assert.equal(result.traceabilityRuleId, "REGRA-SAC-001");
  assert.equal(result.indexSlug, null);
  assert.equal(result.accumulatedFactor, 1);
  assert.equal(result.installments.length, 4);
  assert.deepEqual(result.installments.map((row) => row.installmentInCents), [260_000, 257_500, 255_000, 252_500]);
  assert.equal(result.correctedInCents, 1_025_000);
});

test("REGRA-SAC-001 com IPCA: saldo corrigido mês a mês", async () => {
  const repository = {
    ...noGaps,
    ...series([
      month("2023-01-01T00:00:00.000Z", 0, 1.0),
      month("2023-02-01T00:00:00.000Z", 2, null),
    ]),
  };
  const result = await calculateSac({ principalInCents: 1_000_000, monthlyInterestRate: 0.01, months: 2, indexSlug: "ipca", startDate: "2023-01-01", endDate: "2023-02-28" }, repository);
  assert.equal(result.traceabilityRuleId, "REGRA-SAC-001");
  assert.ok(Math.abs(result.accumulatedFactor - 1.02) < 1e-12);
  assert.equal(result.installments.length, 2);
  assert.equal(result.installments[0].installmentInCents, 510_000);
  assert.equal(result.installments[1].installmentInCents, 515_100);
  assert.equal(result.installments[1].remainingInCents, 0);
});

test("REGRA-PRICE-001 sem índice: prestação constante", async () => {
  const result = await calculatePrice({ principalInCents: 1_000_000, monthlyInterestRate: 0.01, months: 4, startDate: "2023-01-01", endDate: "2023-04-30" }, noGaps);
  assert.equal(result.type, "price");
  assert.equal(result.traceabilityRuleId, "REGRA-PRICE-001");
  assert.equal(result.installments.length, 4);
  assert.equal(result.installments[0].installmentInCents, 256_281);
  assert.equal(result.installments[3].remainingInCents, 0);
});

test("REGRA-DIF-001 corrige diferença salarial com reflexos", async () => {
  const repository = {
    ...noGaps,
    ...series([
      month("2023-01-01T00:00:00.000Z", 0, 1.0),
      month("2023-02-01T00:00:00.000Z", 2, null),
    ]),
  };
  const result = await calculateSalaryDifference({ salaryPreviousInCents: 300_000, salaryNewInCents: 330_000, startDate: "2023-01-01", endDate: "2023-02-28" }, repository);
  assert.equal(result.type, "salary");
  assert.equal(result.traceabilityRuleId, "REGRA-DIF-001");
  assert.equal(result.principalInCents, 30_000);
  assert.equal(result.correctedInCents, 72_383);
  assert.equal(result.params.reflections.decimoTerceiro, true);
});

test("REGRA-DIF-002 reproduz a memória detalhada de diferenças salariais", async () => {
  const entries = [
    ["11/2015", "Subsídio", 582012.0591, 518127, 1.379823, .269413, .3519],
    ["12/2015", "Subsídio", 582012, 518127, 1.368193, .269413, .3519],
    ["01/2016", "Subsídio", 582012, 518127, 1.352237, .269413, .3519],
    ["01/2016", "Adicional de férias", 116402.4118, 103625.4, 1.352237, .269413, .3519],
    ["02/2016", "Subsídio", 582012, 518127, 1.33991, .269413, .3519],
    ["02/2016", "13º salário", 582012, 518127, 1.33991, .269413, .3519],
    ["03/2016", "Subsídio", 672224.9283, 598436.685, 1.32115, .262234, .3519],
    ["04/2016", "Subsídio", 672224.9283, 598436.685, 1.315493, .255923, .3519],
    ["05/2016", "Subsídio", 672224.9283, 598436.685, 1.308818, .249382, .3519],
    ["05/2016", "Adicional de férias", 74691.584, 66492.89851, 1.308818, .249382, .3519],
    ["06/2016", "Subsídio", 672224.9283, 598436.685, 1.297658, .242329, .3519],
    ["07/2016", "Subsídio", 672224.9283, 598436.685, 1.292488, .2357, .3519],
    ["08/2016", "Subsídio", 672224.9283, 598436.685, 1.285546, .228142, .3519],
    ["09/2016", "Subsídio", 672224.9283, 598436.685, 1.279787, .221559, .3519],
    ["09/2016", "Adicional de férias", 149383.168, 132985.797, 1.279787, .221559, .3519],
    ["10/2016", "Subsídio", 672224.9283, 598436.685, 1.27685, .21495, .3519],
    ["11/2016", "Subsídio", 672224.9283, 598436.685, 1.274429, .208515, .3519],
  ].map(([competence, description, dueInCents, receivedInCents, correctionFactor, interestRate, selicRate]) => ({ competence, description, dueInCents, receivedInCents, correctionFactor, interestRate, selicRate }));
  const result = await calculateSalaryDifference({
    salaryPreviousInCents: 1,
    salaryNewInCents: 2,
    entries,
    startDate: "2015-11-01",
    endDate: "2025-01-31",
  }, noGaps);

  assert.equal(result.traceabilityRuleId, "REGRA-DIF-002");
  assert.equal(result.params.calculationMode, "detailed");
  assert.equal(result.months.length, 17);
  assert.equal(result.correctedInCents, 2_262_008);
  assert.equal(result.params.summary.selicInCents, 588_801);
});

test("REGRA-JUD-001 combina IPCA-E com fator Selic informado", async () => {
  const repository = {
    ...noGaps,
    ...series([
      month("2020-01-01T00:00:00.000Z", 0.5, null),
      month("2020-02-01T00:00:00.000Z", 0.6, null),
    ]),
  };
  const result = await calculateJudicialCorrection({ principalInCents: 1_000_000, selicAccumulatedFactor: 1.06, startDate: "2020-01-01", endDate: "2022-01-01" }, repository);
  assert.equal(result.type, "judicial");
  assert.equal(result.traceabilityRuleId, "REGRA-JUD-001");
  assert.ok(Math.abs(result.accumulatedFactor - 1.005 * 1.006 * 1.06) < 1e-12);
  assert.equal(result.months.length, 3);
  assert.equal(result.months[2].competence, "Fase Selic (a partir de 09/12/2021)");
  assert.equal(result.months[2].factor, null);
});

test("POST /run calcula SAC e modela saída única", async (t) => {
  const app = Fastify();
  await app.register(calculationRoutes, { prefix: "/api/calculations", repository: { list: async () => [], findById: async () => null } });
  t.after(() => app.close());

  const raw = await app.inject({ method: "POST", url: "/api/calculations/run", payload: { type: "sac", principalInCents: 1_000_000, monthlyInterestRate: 0.01, months: 4, startDate: "2023-01-01", endDate: "2023-04-30" } });
  assert.equal(raw.statusCode, 200);
  assert.equal(raw.json().type, "sac");
  assert.equal(raw.json().installments.length, 4);

  const invalid = await app.inject({ method: "POST", url: "/api/calculations/run", payload: { type: "sac", principalInCents: -5, months: 4 } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().code, "INVALID_CALCULATION_INPUT");
});

test("POST / salva resultado SAC com parcelas", async (t) => {
  const saved = [];
  const app = Fastify();
  await app.register(calculationRoutes, {
    prefix: "/api/calculations",
    repository: {
      list: async () => saved,
      findById: async (id) => saved.find((item) => item.id === id) ?? null,
      create: async (data) => { const record = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ...data }; saved.push(record); return record; },
      remove: async () => {},
    },
  });
  t.after(() => app.close());

  const sac = await app.inject({ method: "POST", url: "/api/calculations/run", payload: { type: "sac", principalInCents: 1_000_000, monthlyInterestRate: 0.01, months: 4, startDate: "2023-01-01", endDate: "2023-04-30" } });
  const created = await app.inject({ method: "POST", url: "/api/calculations", payload: { title: "Financiamento casa", calculationType: "Financiamento SAC", result: sac.json() } });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().traceabilityRuleId, "REGRA-SAC-001");
  assert.equal(created.json().installments.length, 4);
  assert.equal(created.json().indexSlug, null);

  const draft = await app.inject({ method: "POST", url: "/api/calculations", payload: { title: "Rascunho de revisão", calculationType: "Correção monetária", status: "Rascunho", startDate: "2023-01-01", endDate: "2024-05-31", principalInCents: 800_000 } });
  assert.equal(draft.statusCode, 201);
  assert.equal(draft.json().status, "Rascunho");
  assert.equal(draft.json().correctedInCents, null);
  assert.equal(draft.json().startDate, "2023-01-01T00:00:00.000Z");

  const noData = await app.inject({ method: "POST", url: "/api/calculations", payload: { title: "Vazio" } });
  assert.equal(noData.statusCode, 400);
});

test("REGRA-CM-001 com regras por período acumula índices diferentes em sequência", async () => {
  const monthly = [
    month("2023-01-01T00:00:00.000Z", 1, null),
    month("2023-02-01T00:00:00.000Z", 2, null),
    month("2023-03-01T00:00:00.000Z", 3, null),
  ];
  const repository = {
    ...noGaps,
    findValuesBetween: async (_slug, from, to) => ({ values: monthly.filter((item) => item.referenceDate >= new Date(from) && item.referenceDate <= new Date(to)) }),
  };
  const result = await calculateMonetaryCorrection({
    principalInCents: 1_000_000,
    indexSlug: "ipca",
    periods: [
      { indexSlug: "ipca", startDate: "2023-01-01", endDate: "2023-02-28" },
      { indexSlug: "inpc", startDate: "2023-03-01", endDate: "2023-03-31" },
    ],
    startDate: "2023-01-01",
    endDate: "2023-03-31",
  }, repository);

  const expected = (1.01 * 1.02) * 1.03;
  assert.ok(Math.abs(result.accumulatedFactor - expected) < 1e-12);
  assert.equal(result.correctedInCents, Math.round(1_000_000 * expected));
  assert.equal(result.months.length, 3);
  assert.equal(result.months[2].competence, "03/2023");
  assert.ok(Math.abs(result.months[2].accumulatedFactor - expected) < 1e-12);
});

test("PUT /:id atualiza vínculo e título; GET filtra por cliente e processo", async (t) => {
  const clientA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const clientB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const processA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const base = { id: "00000000-0000-4000-8000-000000000001", calculationType: "Correção monetária", status: "Concluído", clientId: clientA, processId: processA };
  const records = [{ ...base }, { ...base, id: "00000000-0000-4000-8000-000000000002", clientId: null, processId: null }];

  const app = Fastify();
  await app.register(calculationRoutes, {
    prefix: "/api/calculations",
    repository: {
      list: async (filters = {}) => records.filter((record) => (!filters.clientId || record.clientId === filters.clientId) && (!filters.processId || record.processId === filters.processId)),
      findById: async (id) => records.find((record) => record.id === id) ?? null,
      update: async (id, data) => {
        const record = records.find((item) => item.id === id);
        if (!record) { const error = new Error("not found"); error.code = "P2025"; throw error; }
        Object.assign(record, data);
        return record;
      },
      create: async () => ({}),
      remove: async () => {},
    },
  });
  t.after(() => app.close());

  const byClientBefore = await app.inject({ method: "GET", url: `/api/calculations?clientId=${clientA}` });
  assert.equal(byClientBefore.json().length, 1);

  const byProcess = await app.inject({ method: "GET", url: `/api/calculations?processId=${processA}` });
  assert.equal(byProcess.json().length, 1);

  const updated = await app.inject({ method: "PUT", url: "/api/calculations/00000000-0000-4000-8000-000000000001", payload: { title: "Revisão habitacional", clientId: clientB, processId: null } });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().title, "Revisão habitacional");
  assert.equal(updated.json().clientId, clientB);
  assert.equal(updated.json().processId, null);

  const byClient = await app.inject({ method: "GET", url: `/api/calculations?clientId=${clientB}` });
  assert.equal(byClient.statusCode, 200);
  assert.equal(byClient.json().length, 1);
  assert.equal(byClient.json()[0].id, "00000000-0000-4000-8000-000000000001");

  const byProcessAfter = await app.inject({ method: "GET", url: `/api/calculations?processId=${processA}` });
  assert.equal(byProcessAfter.json().length, 0);

  const empty = await app.inject({ method: "PUT", url: "/api/calculations/00000000-0000-4000-8000-000000000099", payload: { title: "X" } });
  assert.equal(empty.statusCode, 404);

  const invalid = await app.inject({ method: "PUT", url: "/api/calculations/00000000-0000-4000-8000-000000000001", payload: { processId: "não-é-uuid" } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().code, "INVALID_CALCULATION_INPUT");
});
