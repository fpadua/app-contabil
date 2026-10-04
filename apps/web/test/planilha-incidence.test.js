import assert from "node:assert/strict";
import test from "node:test";
import { applyIncidenceRules, buildPlanilhaResult, calculateIncidenceBreakdown, calculateIncidenceFactor, createPlanilhaRow, createPlanilhaSheet, evaluatePlanilhaSheet, maskPlanilhaCompetence, planilhaCompetenceCursorPosition } from "../lib/planilha.js";

function month(year, number, monthlyValue, accumulatedPositive = null) {
  return { referenceDate: `${year}-${String(number).padStart(2, "0")}-01`, monthlyValue, accumulatedPositive, published: true };
}

const IPCA_REFERENCE_RATES = [
  [2015, 11, [0.85, 1.18]],
  [2016, 1, [0.92, 1.42, 0.43, 0.51, 0.86, 0.40, 0.54, 0.45, 0.23, 0.19, 0.26, 0.19]],
  [2017, 1, [0.31, 0.54, 0.15, 0.21, 0.24, 0.16, -0.18, 0.35, 0.11, 0.34, 0.32, 0.35]],
  [2018, 1, [0.39, 0.38, 0.10, 0.21, 0.14, 1.11, 0.64, 0.13, 0.09, 0.58, 0.19, -0.16]],
  [2019, 1, [0.30, 0.34, 0.54, 0.72, 0.35, 0.06, 0.09, 0.08, 0.09, 0.09, 0.14, 1.05]],
  [2020, 1, [0.71, 0.22, 0.02, -0.01, -0.59, 0.02, 0.30, 0.23, 0.45, 0.94, 0.81, 1.06]],
  [2021, 1, [0.78, 0.48, 0.93, 0.60, 0.44, 0.83, 0.72, 0.89, 1.14, 1.20, 1.17, 0]],
];
const SAVINGS_REFERENCE_RATES = [
  [2016, [0.6327, 0.5962, 0.7179, 0.6311, 0.6541, 0.7053, 0.6629, 0.7558, 0.6583, 0.6609, 0.6435, 0.6858]],
  [2017, [0.6709, 0.5304, 0.6527, 0.5, 0.5768, 0.5539, 0.5626, 0.5512, 0.5, 0.469, 0.4273, 0.4273]],
  [2018, [0.3994, 0.3994, 0.3855, ...Array(9).fill(0.3715)]],
  [2019, [0.3715, 0.3715, 0.3715, 0.3715, 0.3715, 0.3715, 0.3715, 0.3434, 0.3434, 0.3153, 0.2871, 0.2871]],
  [2020, [0.2588, 0.2588, 0.2446, 0.2162, 0.2162, 0.1733, 0.1303, 0.1303, 0.1159, 0.1159, 0.1159, 0.1159]],
  [2021, [0.1159, 0.1159, 0.1159, 0.159, 0.159, 0.2019, 0.2446, 0.2446, 0.3012, 0.3575, 0.4412, 0.4902]],
];
const SELIC_REFERENCE_RATES = [
  [2022, [0.77, 0.73, 0.76, 0.93, 0.83, 1.03, 1.02, 1.03, 1.17, 1.07, 1.02, 1.02]],
  [2023, [1.12, 1.12, 0.92, 1.17, 0.92, 1.12, 1.07, 1.07, 1.14, 0.97, 1.00, 0.92]],
  [2024, [0.89, 0.97, 0.80, 0.83, 0.89, 0.83, 0.79, 0.91, 0.87, 0.84, 0.93, 0.79]],
  [2025, [0.93, 1.01, 0.99, 0.96, 1.06, 1.14, 1.10, 1.28, 1.16, 1.22, 1.28, 1.05]],
  [2026, [1.22, 1.16, 1.00, 1.21, 1.09, 1.07, 1.12, 1.22]],
];

function referenceValues(rows) {
  return rows.flatMap(([year, firstMonthOrRates, maybeRates]) => {
    const firstMonth = maybeRates ? firstMonthOrRates : 1;
    const rates = maybeRates ?? firstMonthOrRates;
    return rates.map((rate, index) => month(year, firstMonth + index, rate));
  });
}

function previousMonthValues(rows) {
  return referenceValues(rows).map((value) => {
    const date = new Date(`${value.referenceDate}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return { ...value, referenceDate: date.toISOString().slice(0, 10) };
  });
}

test("máscara de competência mantém o cursor depois da barra", () => {
  let value = "";
  let cursor = 0;
  for (const digit of "112015") {
    const nextInput = `${value.slice(0, cursor)}${digit}${value.slice(cursor)}`;
    const nextValue = maskPlanilhaCompetence(nextInput);
    cursor = planilhaCompetenceCursorPosition(nextInput, cursor + 1);
    value = nextValue;
  }
  assert.equal(value, "11/2015");
  assert.equal(cursor, value.length);
});

test("IPCA-E da aba Indice acumula regressivamente somente até o fim escolhido", () => {
  const values = [month(2021, 7, 0.72, 1.05225), month(2021, 8, 0.89, 1.044728), month(2021, 9, 1.14, 1.035512), month(2021, 10, 1.20, 1.02384), month(2021, 11, 1.17, 1.0117)];
  assert.equal(calculateIncidenceFactor(values, "07/2021", "10/2021"), 1.040081);
  assert.equal(calculateIncidenceFactor(values, "10/2021", "10/2021"), 1.012);
});

test("IPCA-E de 11/2015 a 12/2021 reproduz 1,379823 da aba Indice", () => {
  const values = referenceValues(IPCA_REFERENCE_RATES);
  assert.equal(calculateIncidenceFactor(values, "11/2015", "12/2021"), 1.379823);
  assert.equal(calculateIncidenceBreakdown({ index: "ipca_e", start: "11/2015", end: "12/2021" }, values).accumulated, 1.379823);
});

test("Selic soma as competências posteriores ao mês-base e preenche a coluna K por linha", () => {
  const values = previousMonthValues(SELIC_REFERENCE_RATES);
  assert.equal(calculateIncidenceFactor(values, "12/2021", "08/2026", "selic"), 56.53);
  const breakdown = calculateIncidenceBreakdown({ index: "selic", start: "12/2021", end: "08/2026" }, values);
  assert.deepEqual(breakdown.rows.slice(0, 2).map(({ appliedRate, accumulated }) => [appliedRate, accumulated]), [[null, 56.53], [0.77, 55.76]]);
  assert.deepEqual([breakdown.rows.at(-1).month, breakdown.rows.at(-1).appliedRate, breakdown.rows.at(-1).accumulated], [2026 * 12 + 7, 1.22, 0]);
  const sheet = createPlanilhaSheet({
    incidenceRules: [{ index: "selic", start: "12/2021", end: "08/2026" }],
    rows: [createPlanilhaRow({ label: "11/2015", kind: "base", adjustment: "10", correction: "1" }), createPlanilhaRow({ label: "01/2022" })],
    baseReceived: "100",
  });
  const applied = applyIncidenceRules(sheet, { selic: values });
  assert.equal(applied.rows[0].selic, "56,53%");
  assert.equal(applied.rows[1].selic, "55,76%");
  assert.equal(applied.rows[0].correction, "1,000000");
  const evaluation = evaluatePlanilhaSheet(applied);
  assert.equal(evaluation.rows[0].selicRate, 0.5653);
  const result = buildPlanilhaResult({ sheet: applied, sourceSheet: sheet, evaluation });
  assert.equal(result.months[0].selicRate, 0.5653);
  assert.equal(result.params.sheet.rows[0].selic, "");
  assert.equal(result.params.sheet.incidenceRules.length, 1);
});

test("juros de poupança de 02/2016 a 12/2021 reproduzem 26,9413%", () => {
  const values = referenceValues(SAVINGS_REFERENCE_RATES);
  assert.equal(calculateIncidenceFactor(values, "02/2016", "12/2021", "juros"), 26.9413);
});

test("primeiro lançamento reproduz os fatores e valores da linha 11/2015 da Plan 1", () => {
  const sheet = createPlanilhaSheet({
    baseReceived: "6.283,59",
    incidenceRules: [
      { index: "ipca_e", start: "11/2015", end: "12/2021" },
      { index: "juros", start: "02/2016", end: "12/2021" },
      { index: "selic", start: "12/2021", end: "08/2026" },
    ],
    rows: [createPlanilhaRow({ label: "11/2015", kind: "base", adjustment: "12,33" })],
  });
  const applied = applyIncidenceRules(sheet, {
    ipca_e: referenceValues(IPCA_REFERENCE_RATES),
    poupanca: referenceValues(SAVINGS_REFERENCE_RATES),
    selic: previousMonthValues(SELIC_REFERENCE_RATES),
  });
  const evaluated = evaluatePlanilhaSheet(applied).rows[0];
  assert.equal(applied.rows[0].correction, "1,379823");
  assert.equal(applied.rows[0].interest, "26,9413%");
  assert.equal(applied.rows[0].selic, "56,53%");
  assert.equal(Math.round(evaluated.due * 100), 705836);
  assert.equal(Math.round(evaluated.received * 100), 628359);
  assert.equal(Math.round(evaluated.corrected * 100), 106904);
  assert.equal(Math.round(evaluated.interest * 100), 28801);
  assert.equal(Math.round(evaluated.selic * 100), 76714);
  assert.equal(Math.round(evaluated.total * 100), 212420);
});

test("regra cadastrada antes das linhas acompanha a competência e a Selic prevalece por mês", () => {
  const sheet = createPlanilhaSheet({
    incidenceRules: [
      { index: "ipca_e", start: "07/2021", end: "11/2021" },
      { index: "juros", start: "07/2021", end: "11/2021" },
      { index: "selic", start: "09/2021", end: "11/2021" },
    ],
    rows: [createPlanilhaRow({ label: "07/2021" }), createPlanilhaRow({ label: "10/2021" })],
  });
  const applied = applyIncidenceRules(sheet, {
    ipca_e: [month(2021, 7, 0.72), month(2021, 8, 0.89), month(2021, 9, 1.14), month(2021, 10, 1.20), month(2021, 11, 1.17)],
    poupanca: [month(2021, 8, 0.24), month(2021, 9, 0.30), month(2021, 10, 0.35), month(2021, 11, 0.44)],
    selic: [month(2021, 9, 0.5), month(2021, 10, 0.6)],
  });
  assert.equal(applied.rows[0].correction, "1,027748");
  assert.equal(applied.rows[0].interest, "0,5400%");
  assert.equal(applied.rows[0].selic, "1,10%");
  assert.equal(applied.rows[1].correction, "1,012000");
  assert.equal(applied.rows[1].interest, "0,0000%");
  assert.equal(applied.rows[1].selic, "0,60%");
  assert.equal(sheet.rows[0].correction, "");
});

test("competência ausente impede acumulado parcial", () => {
  assert.throws(() => calculateIncidenceFactor([month(2021, 7, 0.72), month(2021, 9, 1.14)], "07/2021", "09/2021"), /08\/2021/);
});
