import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { PdfIndexParser, PdfIndexImportError } from "../src/services/pdf-index-parser.js";

const fixture = resolve(dirname(fileURLToPath(import.meta.url)), "../../../docs/selic.pdf");

test("extrai a série histórica do selic.pdf seguindo colunas de anos × linhas de meses", async () => {
  const buffer = await readFile(fixture);
  const parse = new PdfIndexParser();
  const result = await parse.parse(buffer);

  assert.equal(result.name, "Selic (Bacen)");
  assert.equal(result.values.length, 481);

  const byPeriod = (year, month) => result.values.find((value) => value.referenceDate.getUTCFullYear() === year && value.referenceDate.getUTCMonth() === month);
  assert.equal(byPeriod(1987, 0)?.monthlyValue, "11.00");
  assert.equal(byPeriod(1993, 6)?.monthlyValue, "32.73");
  assert.equal(byPeriod(2026, 6)?.monthlyValue, "1.22");

  assert.equal(byPeriod(1986, 0), undefined, "jan/1986 não deve existir (mês ausente no PDF)");
  assert.equal(byPeriod(2026, 7), undefined, "ago/2026 não deve existir (ainda não publicado)");

  const first = result.values[0];
  const last = result.values[result.values.length - 1];
  assert.equal(first.referenceDate.toISOString().slice(0, 7), "1986-07");
  assert.equal(last.referenceDate.toISOString().slice(0, 7), "2026-07");
});

test("rejeita arquivo nulo ou vazio", async () => {
  const parse = new PdfIndexParser();
  await assert.rejects(() => parse.parse(new Uint8Array(0)), PdfIndexImportError);
});
