import assert from "node:assert/strict";
import test from "node:test";
import { PLANILHA_ROW_KINDS, buildSalaryPlanilhaSheet, findSalaryPlanilhaIssues } from "../src/index.js";

const SELIC = 0.5653;
const VACATION_THIRDS = 1 / 6;
const DECIMO_RATE = 0.186;

/**
 * Lançamentos de `Plan 1!A12:M29` do caso DATABASE-689 (Cleiton Barbosa Carneiro
 * Scopel). Cada item traz o rótulo da coluna A, a regra que gera C/D, o índice de
 * reajuste da coluna B, o índice de atualização (F) e os juros (H).
 */
const PLANILHA_689 = [
  { label: "11/2015", kind: PLANILHA_ROW_KINDS.BASE, adjustmentRate: 0.1233, correctionFactor: 1.379823, interestRate: 0.269413 },
  { label: "12/2015", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.368193, interestRate: 0.269413 },
  { label: "ADIC. FÉRIAS", kind: PLANILHA_ROW_KINDS.FRACTION, adjustmentRate: VACATION_THIRDS, correctionFactor: 1.368193, interestRate: 0.269413 },
  { label: "01/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.352237, interestRate: 0.269413 },
  { label: "ADIC. FÉRIAS", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.352237, interestRate: 0.269413 },
  { label: "13.° SALÁRIO", kind: PLANILHA_ROW_KINDS.FRACTION, adjustmentRate: VACATION_THIRDS, correctionFactor: 1.352237, interestRate: 0.269413 },
  { label: "02/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.33991, interestRate: 0.269413 },
  { label: "03/2016*", kind: PLANILHA_ROW_KINDS.ADJUST, adjustmentRate: 0.228501, correctionFactor: 1.32115, interestRate: 0.262234 },
  { label: "04/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.315493, interestRate: 0.255923 },
  { label: "05/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.308818, interestRate: 0.249382 },
  { label: "13.° SALÁRIO", kind: PLANILHA_ROW_KINDS.FRACTION, adjustmentRate: DECIMO_RATE, correctionFactor: 1.308818, interestRate: 0.249382 },
  { label: "06/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.297658, interestRate: 0.242329 },
  { label: "07/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.292488, interestRate: 0.2357 },
  { label: "08/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.285546, interestRate: 0.228142 },
  { label: "09/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.279787, interestRate: 0.221559 },
  { label: "ADIC. FÉRIAS", kind: PLANILHA_ROW_KINDS.FRACTION, adjustmentRate: VACATION_THIRDS, correctionFactor: 1.279787, interestRate: 0.221559 },
  { label: "10/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.27685, interestRate: 0.21495 },
  { label: "11/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1.274429, interestRate: 0.208515 },
].map((row) => ({ ...row, selicRate: SELIC }));

// Valores lidos de `Plan 1` no arquivo do caso DATABASE-689.
const EXPECTED_689 = {
  due12: 7058.356647,
  received12: 6283.59,
  due19: 8671.1981991961475,
  received19: 7719.3965985900004,
  due22: 1612.8428650504836,
  difference12: 774.76664700000038,
  corrected12: 1069.040839163481,
  interest12: 288.01349960155085,
  subtotal12: 1357.0543387650318,
  selic12: 767.14281770387254,
  total12: 2124.1971564689043,
  correctionOnly12: 294.27419216348062,
  sheetTotal: 33446.760929362958,
  totalDue: 118743.39514168186,
  totalReceived: -105709.42325441273,
  correctionOnly: 4105.1607939007818,
  interest: 4228.5035095686098,
  selic: 12079.124738624467,
  payable: 33446.760929362987,
};

function closeTo(actual, expected, tolerance = 1e-6) {
  return Math.abs(actual - expected) <= tolerance;
}

test("REGRA-DIF-004 reproduz as colunas C, D, E, G, I, J, L, M e O da Plan 1", () => {
  const sheet = buildSalaryPlanilhaSheet({ baseReceived: 6283.59, rows: PLANILHA_689 });

  assert.equal(sheet.rows.length, 18);
  const [first, decimo, decimoTerceiro] = [sheet.rows[0], sheet.rows[7], sheet.rows[10]];
  assert.ok(closeTo(first.due, EXPECTED_689.due12), `C12 ${first.due}`);
  assert.ok(closeTo(first.received, EXPECTED_689.received12), `D12 ${first.received}`);
  assert.ok(closeTo(first.difference, EXPECTED_689.difference12), `E12 ${first.difference}`);
  assert.ok(closeTo(first.corrected, EXPECTED_689.corrected12), `G12 ${first.corrected}`);
  assert.ok(closeTo(first.interest, EXPECTED_689.interest12), `I12 ${first.interest}`);
  assert.ok(closeTo(first.subtotal, EXPECTED_689.subtotal12), `J12 ${first.subtotal}`);
  assert.ok(closeTo(first.selic, EXPECTED_689.selic12), `L12 ${first.selic}`);
  assert.ok(closeTo(first.total, EXPECTED_689.total12), `M12 ${first.total}`);
  assert.ok(closeTo(first.correctionOnly, EXPECTED_689.correctionOnly12), `O12 ${first.correctionOnly}`);
  assert.ok(closeTo(decimo.due, EXPECTED_689.due19), `C19 ${decimo.due}`);
  assert.ok(closeTo(decimo.received, EXPECTED_689.received19), `D19 ${decimo.received}`);
  assert.ok(closeTo(decimoTerceiro.due, EXPECTED_689.due22), `C22 ${decimoTerceiro.due}`);
});

test("REGRA-DIF-004 reproduz I30 e o resumo I33:I38 do DATABASE-689", () => {
  const sheet = buildSalaryPlanilhaSheet({ baseReceived: 6283.59, rows: PLANILHA_689 });

  assert.ok(closeTo(sheet.sheetTotal, EXPECTED_689.sheetTotal, 1e-6), `I30 ${sheet.sheetTotal}`);
  assert.ok(closeTo(sheet.totals.due, EXPECTED_689.totalDue, 1e-6), `I33 ${sheet.totals.due}`);
  assert.ok(closeTo(sheet.totals.received, EXPECTED_689.totalReceived, 1e-6), `I34 ${sheet.totals.received}`);
  assert.ok(closeTo(sheet.totals.correctionOnly, EXPECTED_689.correctionOnly, 1e-6), `I35 ${sheet.totals.correctionOnly}`);
  assert.ok(closeTo(sheet.totals.interest, EXPECTED_689.interest, 1e-6), `I36 ${sheet.totals.interest}`);
  assert.ok(closeTo(sheet.totals.selic, EXPECTED_689.selic, 1e-6), `I37 ${sheet.totals.selic}`);
  assert.ok(closeTo(sheet.payable, EXPECTED_689.payable, 1e-6), `I38 ${sheet.payable}`);
  assert.ok(sheet.check < 1e-6, `N38 ${sheet.check}`);
});

test("REGRA-DIF-004 mantém a base vigente apenas nas linhas de base e reajuste", () => {
  const sheet = buildSalaryPlanilhaSheet({ baseReceived: 100, rows: [
    { label: "11/2015", kind: PLANILHA_ROW_KINDS.BASE, adjustmentRate: 0.1, correctionFactor: 1, interestRate: 0, selicRate: 0 },
    { label: "ADIC. FÉRIAS", kind: PLANILHA_ROW_KINDS.FRACTION, adjustmentRate: 1 / 6, correctionFactor: 1, interestRate: 0, selicRate: 0 },
    { label: "12/2015", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1, interestRate: 0, selicRate: 0 },
    { label: "03/2016*", kind: PLANILHA_ROW_KINDS.ADJUST, adjustmentRate: 0.2, correctionFactor: 1, interestRate: 0, selicRate: 0 },
    { label: "04/2016", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 1, interestRate: 0, selicRate: 0 },
  ] });

  const bases = sheet.rows.map((cell) => [cell.due, cell.received]);
  [[110, 100], [110 / 6, 100 / 6], [110, 100], [132, 120], [132, 120]].forEach(([due, received], index) => {
    assert.ok(closeTo(bases[index][0], due, 1e-9), `linha ${index + 1} coluna C`);
    assert.ok(closeTo(bases[index][1], received, 1e-9), `linha ${index + 1} coluna D`);
  });
});

test("REGRA-DIF-004 assume o neutro da coluna em células vazias", () => {
  const sheet = buildSalaryPlanilhaSheet({ baseReceived: 0, rows: [
    { label: "11/2015", kind: PLANILHA_ROW_KINDS.MONTHLY, selicRate: 0 },
  ] });

  assert.equal(sheet.rows[0].correctionFactor, 1);
  assert.equal(sheet.rows[0].interestRate, 0);
  assert.equal(sheet.rows[0].selicRate, 0);
  assert.equal(sheet.rows[0].informed.correctionFactor, false);
  assert.equal(sheet.rows[0].total, 0);
});

test("REGRA-DIF-004 não confunde célula vazia com célula preenchida", () => {
  const empty = buildSalaryPlanilhaSheet({ baseReceived: 100, rows: [{ kind: PLANILHA_ROW_KINDS.MONTHLY }] });
  assert.equal(empty.rows[0].informed.interestRate, false);
  assert.equal(empty.rows[0].informed.selicRate, false);
  assert.equal(empty.rows[0].informed.adjustmentRate, false);

  const zero = buildSalaryPlanilhaSheet({ baseReceived: 100, rows: [{ label: "11/2015", kind: PLANILHA_ROW_KINDS.MONTHLY, interestRate: 0, selicRate: 0, correctionFactor: 1 }] });
  assert.equal(zero.rows[0].informed.interestRate, true);
  assert.equal(zero.rows[0].informed.selicRate, true);
  assert.equal(zero.rows[0].informed.correctionFactor, true);
});

test("REGRA-DIF-004 aplica a taxa Selic padrão às linhas que não informam a coluna K", () => {
  const sheet = buildSalaryPlanilhaSheet({ baseReceived: 100, defaultSelicRate: 0.5, rows: [
    { label: "11/2015", kind: PLANILHA_ROW_KINDS.BASE, adjustmentRate: 1, correctionFactor: 2, interestRate: 0 },
    { label: "12/2015", kind: PLANILHA_ROW_KINDS.MONTHLY, correctionFactor: 2, interestRate: 0, selicRate: 0.25 },
  ] });

  assert.equal(sheet.rows[0].selicRate, 0.5);
  assert.equal(sheet.rows[0].selic, 100);
  assert.equal(sheet.rows[1].selicRate, 0.25);
  assert.equal(sheet.rows[1].selic, 50);
});

test("REGRA-DIF-004 aponta as células que impedem a gravação", () => {
  const empty = buildSalaryPlanilhaSheet({ baseReceived: 0, rows: [{ kind: PLANILHA_ROW_KINDS.MONTHLY }] });
  const messages = findSalaryPlanilhaIssues(empty).map((issue) => issue.message);

  assert.ok(messages.includes("informe o mês ou o evento na coluna A."));
  assert.ok(messages.includes("informe o índice de atualização na coluna F."));
  assert.ok(messages.includes("a soma das diferenças precisa ser maior que zero."));

  const ready = buildSalaryPlanilhaSheet({ baseReceived: 6283.59, rows: PLANILHA_689 });
  assert.deepEqual(findSalaryPlanilhaIssues(ready), []);
});

test("REGRA-DIF-004 recusa linhas que não são uma lista", () => {
  assert.throws(() => buildSalaryPlanilhaSheet({ baseReceived: 1, rows: null }), TypeError);
});
