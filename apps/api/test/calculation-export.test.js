import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { calculationRoutes } from "../src/routes/calculations.js";
import { buildCalculationPdfHtml, slugFileName } from "../src/services/calculation-export-service.js";

const RECORD_SLUG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const record = {
  id: RECORD_SLUG,
  title: "Revisão contratual — Contrato 2021",
  calculationType: "Correção monetária",
  client: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Maria" },
  process: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Processo 042", number: "0000000-42" },
  indexSlug: "ipca",
  startDate: "2023-01-01T00:00:00.000Z",
  endDate: "2024-05-31T00:00:00.000Z",
  principalInCents: 1_000_000,
  accumulatedFactor: "1.0699512859259",
  correctedInCents: 1_069_951,
  correctionInCents: 69_951,
  traceabilityRuleId: "REGRA-CM-001",
  months: [
    { referenceDate: "2023-01-01T00:00:00.000Z", competence: "01/2023", factor: 1.0053, accumulatedFactor: 1.0053, correctedInCents: 1_005_300 },
    { referenceDate: "2023-02-01T00:00:00.000Z", competence: "02/2023", factor: 1.0084, accumulatedFactor: 1.01374452, correctedInCents: 1_013_745 },
  ],
};

test("buildCalculationPdfHtml monta documento com parâmetros, memória e total", () => {
  const html = buildCalculationPdfHtml(record, { issuedAt: new Date("2026-08-31T12:00:00.000Z") });
  assert.ok(html.includes("<title>Memória de cálculo — Revisão contratual — Contrato 2021</title>"));
  assert.ok(html.includes("Maria"));
  assert.ok(html.includes("Processo 042 (0000000-42)"));
  assert.ok(html.includes("IPCA (IBGE)"));
  assert.ok(html.includes("01/01/2023 a 31/05/2024"));
  assert.ok(html.includes("01/2023"));
  assert.ok(html.includes("TOTAL"));
  assert.ok(html.includes("1,0053"));
  assert.ok(html.includes("1,069951"));
  assert.ok(html.includes("REGRA-CM-001"));
});

test("buildCalculationPdfHtml escapa conteúdo e nota ausência de memória", () => {
  const html = buildCalculationPdfHtml({ ...record, title: "<script>alert(1)</script>", months: null });
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(html.includes("sem memória de competências"));
});

test("slugFileName sanitiza título para nome de arquivo", () => {
  assert.equal(slugFileName("Revisão contratual — Contrato 2021"), "revisao-contratual-contrato-2021");
  assert.equal(slugFileName(""), "memoria-de-calculo");
});

test("GET /:id/export entrega PDF com renderer injetado", async (t) => {
  const app = Fastify();
  await app.register(calculationRoutes, {
    prefix: "/api/calculations",
    repository: { findById: async (id) => (id === RECORD_SLUG ? record : null) },
    exportPdf: async (calculation) => Buffer.from("FAKE-PDF-CONTENT"),
  });
  t.after(() => app.close());

  const ok = await app.inject({ method: "GET", url: `/api/calculations/${RECORD_SLUG}/export?format=pdf` });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers["content-type"], "application/pdf");
  assert.equal(ok.body, "FAKE-PDF-CONTENT");
  assert.ok(ok.headers["content-disposition"].includes("filename*=UTF-8''revisao-contratual-contrato-2021.pdf"));

  const badFormat = await app.inject({ method: "GET", url: `/api/calculations/${RECORD_SLUG}/export?format=csv` });
  assert.equal(badFormat.statusCode, 400);
  assert.equal(badFormat.json().code, "INVALID_EXPORT_FORMAT");

  const missing = await app.inject({ method: "GET", url: `/api/calculations/ffffffff-ffff-4fff-8fff-ffffffffffff/export?format=pdf` });
  assert.equal(missing.statusCode, 404);
});