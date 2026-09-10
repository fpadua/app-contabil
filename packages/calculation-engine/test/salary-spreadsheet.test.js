import assert from "node:assert/strict";
import test from "node:test";
import { buildSalarySpreadsheetRows, calculateSalarySpreadsheet } from "../src/index.js";

// Valores exatos de `Plan 1!C12:D28` (reais x 100) e fatores `F/H/K`.
const SPREADSHEET_ROWS = [
  ["11/2015", "Subsídio", 582012.0591, 518127, 1.379823, 0.269413],
  ["12/2015", "Subsídio", 582012.0591, 518127, 1.368193, 0.269413],
  ["01/2016", "Subsídio", 582012.0591, 518127, 1.352237, 0.269413],
  ["01/2016", "Adicional de férias", 116402.4118, 103625.4, 1.352237, 0.269413],
  ["02/2016", "Subsídio", 582012.0591, 518127, 1.33991, 0.269413],
  ["02/2016", "13º salário", 582012.0591, 518127, 1.33991, 0.269413],
  ["03/2016", "Subsídio", 672224.9283, 598436.685, 1.32115, 0.262234],
  ["04/2016", "Subsídio", 672224.9283, 598436.685, 1.315493, 0.255923],
  ["05/2016", "Subsídio", 672224.9283, 598436.685, 1.308818, 0.249382],
  ["05/2016", "Adicional de férias", 74691.584, 66492.89851, 1.308818, 0.249382],
  ["06/2016", "Subsídio", 672224.9283, 598436.685, 1.297658, 0.242329],
  ["07/2016", "Subsídio", 672224.9283, 598436.685, 1.292488, 0.2357],
  ["08/2016", "Subsídio", 672224.9283, 598436.685, 1.285546, 0.228142],
  ["09/2016", "Subsídio", 672224.9283, 598436.685, 1.279787, 0.221559],
  ["09/2016", "Adicional de férias", 149383.168, 132985.797, 1.279787, 0.221559],
  ["10/2016", "Subsídio", 672224.9283, 598436.685, 1.27685, 0.21495],
  ["11/2016", "Subsídio", 672224.9283, 598436.685, 1.274429, 0.208515],
].map(([competence, description, dueInCents, receivedInCents, correctionFactor, interestRate]) => ({
  competence, description, dueInCents, receivedInCents, correctionFactor, interestRate, selicRate: 0.3519,
}));

// Plano de geração das colunas B/C/D a partir dos salários-base.
const SALARY_PLAN = [
  { competence: "11/2015", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "12/2015", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "01/2016", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "01/2016", description: "Adicional de férias", rule: { kind: "fraction", rate: 0.2 } },
  { competence: "02/2016", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "02/2016", description: "13º salário", rule: { kind: "copy" } },
  { competence: "03/2016", description: "Subsídio", rule: { kind: "adjust", rate: 0.155, dueExtraInCents: 1 } },
  { competence: "04/2016", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "05/2016", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "05/2016", description: "Adicional de férias", rule: { kind: "fraction", rate: 0.111111 } },
  { competence: "06/2016", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "07/2016", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "08/2016", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "09/2016", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "09/2016", description: "Adicional de férias", rule: { kind: "fraction", rate: 0.222222 } },
  { competence: "10/2016", description: "Subsídio", rule: { kind: "monthly" } },
  { competence: "11/2016", description: "Subsídio", rule: { kind: "monthly" } },
];

test("REGRA-DIF-003 gera os salários C/D a partir da base e dos reajustes", () => {
  const rows = buildSalarySpreadsheetRows({ baseDueInCents: 582012.0591, baseReceivedInCents: 518127, rows: SALARY_PLAN });

  assert.equal(rows.length, 17);
  rows.forEach((row, index) => {
    assert.ok(Math.abs(row.dueInCents - SPREADSHEET_ROWS[index].dueInCents) < 0.01, `due da linha ${index + 1}`);
    assert.ok(Math.abs(row.receivedInCents - SPREADSHEET_ROWS[index].receivedInCents) < 0.01, `received da linha ${index + 1}`);
  });
});

test("REGRA-DIF-003 reproduz o total da planilha em precisão cheia", () => {
  const result = calculateSalarySpreadsheet({ rows: SPREADSHEET_ROWS });

  assert.equal(result.months.length, 17);
  assert.ok(Math.abs(result.raw.total - 2262008.265335972) < 0.01);
  assert.equal(result.correctedInCents, 2262008);
  assert.equal(result.principalInCents, 1020893);
  assert.deepEqual(result.summary, {
    dueInCents: 9300562,
    receivedInCents: 8279669,
    monetaryCorrectionInCents: 321043,
    interestInCents: 331271,
    selicInCents: 588801,
  });
});

test("REGRA-DIF-003 reproduz o resultado de ponta a ponta a partir do plano salarial", () => {
  const salaries = buildSalarySpreadsheetRows({ baseDueInCents: 582012.0591, baseReceivedInCents: 518127, rows: SALARY_PLAN });
  const rows = salaries.map((salary, index) => ({ ...salary, correctionFactor: SPREADSHEET_ROWS[index].correctionFactor, interestRate: SPREADSHEET_ROWS[index].interestRate, selicRate: 0.3519 }));
  const result = calculateSalarySpreadsheet({ rows });

  assert.equal(result.correctedInCents, 2262008);
  assert.deepEqual(result.summary, {
    dueInCents: 9300562,
    receivedInCents: 8279669,
    monetaryCorrectionInCents: 321043,
    interestInCents: 331271,
    selicInCents: 588801,
  });
});

test("REGRA-DIF-003 rejeita entradas inválidas", () => {
  assert.throws(() => buildSalarySpreadsheetRows({ baseDueInCents: 100, baseReceivedInCents: 200, rows: SALARY_PLAN }), TypeError);
  assert.throws(() => buildSalarySpreadsheetRows({ baseDueInCents: 582012.0591, baseReceivedInCents: 518127, rows: [] }), TypeError);
  assert.throws(() => buildSalarySpreadsheetRows({ baseDueInCents: 582012.0591, baseReceivedInCents: 518127, rows: [{ competence: "11/2015", rule: { kind: "unknown" } }] }), TypeError);
  assert.throws(() => calculateSalarySpreadsheet({ rows: [] }), TypeError);
  assert.throws(() => calculateSalarySpreadsheet({ rows: [{ ...SPREADSHEET_ROWS[0], correctionFactor: 0 }] }), TypeError);
});
