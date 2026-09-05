import assert from "node:assert/strict";
import test from "node:test";
import { parseBrazilianDecimal, parseHistoricalTable, parseRecentTable, parseSavingsCards } from "../src/providers/debit-playwright-provider.js";

test("normaliza números brasileiros, percentuais e competências não publicadas", () => {
  assert.equal(parseBrazilianDecimal("1.234,5678%"), "1234.5678");
  assert.equal(parseBrazilianDecimal("-0,05"), "-0.05");
  assert.equal(parseBrazilianDecimal("0.1693%"), "0.1693");
  assert.equal(parseBrazilianDecimal("-"), null);
});

test("converte tabela histórica anual em uma série mensal ordenada", () => {
  const values = parseHistoricalTable([
    ["Ano", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    ["2025", "0,10", "-", "-0,05", "0", "0,20", "0,30", "0,40", "0,50", "0,60", "0,70", "0,80", "0,90"],
  ]);

  assert.equal(values.length, 12);
  assert.equal(values[0].referenceDate.toISOString(), "2025-01-01T00:00:00.000Z");
  assert.equal(values[0].monthlyValue, "0.10");
  assert.equal(values[1].published, false);
  assert.equal(values[2].monthlyValue, "-0.05");
  assert.equal(values[3].monthlyValue, "0");
});

test("lê precisão e acumulado da tabela recente", () => {
  const values = parseRecentTable([
    ["Data", "Variação", "Variação no Período", "Acumulado 12 meses"],
    ["08/2026", "0.1693%", "2.02%", "2.0218%"],
  ]);

  assert.deepEqual(values.get("2026-08"), {
    monthlyValue: "0.1693",
    accumulatedValue: "2.0218",
    rawData: { recentRow: ["08/2026", "0.1693%", "2.02%", "2.0218%"] },
  });
});

test("converte os cartoes anuais da poupanca em uma serie mensal", () => {
  const values = parseSavingsCards([
    [
      ["Data", "%"],
      ["11/2015", "0,6303"],
      ["12/2015", "0,7261"],
    ],
    [
      ["Data", "%"],
      ["01/2016", "0,7261"],
      ["02/2016", "-"],
    ],
  ]);

  assert.equal(values.length, 4);
  assert.equal(values[0].referenceDate.toISOString(), "2015-11-01T00:00:00.000Z");
  assert.equal(values[0].monthlyValue, "0.6303");
  assert.equal(values[3].monthlyValue, null);
  assert.equal(values[3].published, false);
});
