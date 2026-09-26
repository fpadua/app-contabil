import { PLANILHA_ROW_KINDS, buildSalaryPlanilhaSheet, findSalaryPlanilhaIssues } from "@contabil/calculation-engine";

export const PLANILHA_FIRST_ROW_NUMBER = 12;
export const PLANILHA_STORAGE_KEY = "contabil:planilha:entrada";
export const PLANILHA_RULE_ID = "REGRA-DIF-004";

export const PLANILHA_INDEX_OPTIONS = [
  { value: "ipca_e", label: "IPCA-E (IBGE)" },
  { value: "ipca", label: "IPCA (IBGE)" },
  { value: "inpc", label: "INPC (IBGE)" },
  { value: "igp_m", label: "IGP-M (FGV)" },
  { value: "tr", label: "TR (Bacen)" },
];

/**
 * Cada regra reproduz a fórmula que a planilha de referência esconde nas colunas
 * C e D. `base` é a primeira linha: o valor recebido é o literal digitado e a
 * coluna B só reajusta o valor devido (`Plan 1!C12` = `D12*B12+D12`).
 */
export const PLANILHA_ROW_KIND_OPTIONS = [
  { value: PLANILHA_ROW_KINDS.BASE, label: "Base inicial", hint: "Usa o valor recebido base e aplica o reajuste da coluna B apenas no valor devido." },
  { value: PLANILHA_ROW_KINDS.MONTHLY, label: "Mês", hint: "Repete o valor devido e o valor recebido da linha anterior." },
  { value: PLANILHA_ROW_KINDS.ADJUST, label: "Reajuste", hint: "Aplica a taxa da coluna B nos dois valores e passa a valer para as linhas seguintes." },
  { value: PLANILHA_ROW_KINDS.FRACTION, label: "Fração", hint: "Calcula a parte proporcional informada na coluna B, como férias (1/3/2) e 13º salário." },
];

/**
 * `key` é o campo do modelo do motor na célula de cada linha e, para as
 * colunas de entrada, o mesmo campo do estado editável. A linha de soma da
 * grade usa a mesma chave em `columnTotals`.
 */
export const PLANILHA_COLUMNS = [
  { key: "label", letter: "A", label: "Mês", width: 130, role: "input", format: "text" },
  { key: "adjustment", letter: "B", label: "Índice de reajuste", width: 92, role: "input", format: "percent" },
  { key: "due", letter: "C", label: "Valor devido do subsídio", width: 128, role: "formula", format: "currency" },
  { key: "received", letter: "D", label: "Valor recebido do subsídio", width: 128, role: "formula", format: "currency" },
  { key: "difference", letter: "E", label: "Valor da diferença", width: 116, role: "formula", format: "currency" },
  { key: "correction", letter: "F", label: "Índice de atualização", width: 92, role: "input", format: "factor" },
  { key: "corrected", letter: "G", label: "Valor da diferença atualizado", width: 128, role: "formula", format: "currency" },
  { key: "interest", letter: "H", label: "Juros", width: 84, role: "input", format: "percent" },
  { key: "interest", letter: "I", label: "Valor dos juros", width: 116, role: "formula", format: "currency" },
  { key: "subtotal", letter: "J", label: "Valor da diferença com correção e juros", width: 128, role: "formula", format: "currency" },
  { key: "selic", letter: "K", label: "Taxa Selic", width: 84, role: "input", format: "percent" },
  { key: "selic", letter: "L", label: "Valor da Selic", width: 116, role: "formula", format: "currency" },
  { key: "total", letter: "M", label: "Valor da diferença corrigido com juros e selic", width: 128, role: "formula", format: "currency" },
  { key: "spacer", letter: "N", label: "", width: 20, role: "spacer" },
  { key: "correctionOnly", letter: "O", label: "Valor da correção", width: 116, role: "formula", format: "currency" },
];

export const PLANILHA_RESULT_COLUMNS = [
  { key: "rowNumber", label: "Linha", width: "64px" },
  { key: "competence", label: "Competência", width: "112px" },
  { key: "description", label: "Evento", width: "minmax(140px, 1.2fr)" },
  { key: "due", label: "Valor devido", width: "minmax(120px, 1fr)", source: "due" },
  { key: "received", label: "Valor recebido", width: "minmax(120px, 1fr)", source: "received" },
  { key: "difference", label: "Diferença", width: "minmax(120px, 1fr)", source: "difference" },
  { key: "corrected", label: "Atualizado", width: "minmax(120px, 1fr)", source: "corrected" },
  { key: "interest", label: "Juros", width: "minmax(110px, 1fr)", source: "interest" },
  { key: "selic", label: "Selic", width: "minmax(110px, 1fr)", source: "selic" },
  { key: "total", label: "Total", width: "minmax(120px, 1fr)", source: "total" },
];

const COMPETENCE_PATTERN = /^(0[1-9]|1[0-2])\/(19|20)\d{2}$/;

export function createPlanilhaRow(overrides = {}) {
  return {
    id: `row-${Math.random().toString(36).slice(2, 9)}`,
    label: "",
    kind: PLANILHA_ROW_KINDS.MONTHLY,
    adjustment: "",
    correction: "",
    interest: "",
    selic: "",
    ...overrides,
  };
}

export function createPlanilhaSheet(overrides = {}) {
  return {
    title: "",
    baseReceived: "",
    citationDate: "",
    indexSlug: "ipca_e",
    clientId: "",
    processId: "",
    rows: [createPlanilhaRow()],
    ...overrides,
  };
}

/**
 * Aceita a notação brasileira (`1.379,823`) e a que aparece em fatores colados
 * do Excel (`1.379823`), para que a coluna possa ser digitada nos dois formatos.
 */
export function parsePlanilhaNumber(text) {
  const trimmed = String(text ?? "").trim().replace(/\s*%\s*$/, "").replace(/r\$\s*/gi, "");
  if (!trimmed) return null;
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  let normalized;
  if (hasComma && hasDot) {
    normalized = trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(/,/g, "");
  } else if (hasComma) {
    normalized = trimmed.replace(",", ".");
  } else if (hasDot) {
    const parts = trimmed.split(".");
    const looksLikeThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    normalized = looksLikeThousands ? trimmed.replace(/\./g, "") : trimmed;
  } else {
    normalized = trimmed;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toCents(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

const currencyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function maskPlanilhaCurrency(value) {
  const text = String(value ?? "");
  const digits = text.replace(/\D/g, "");
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return currencyFormat.format(text.trim().startsWith("-") ? -amount : amount);
}

export function formatPlanilhaCurrencyInput(value) {
  const amount = parsePlanilhaNumber(value);
  return amount == null ? "" : currencyFormat.format(amount);
}

export function maskPlanilhaDate(value) {
  const text = String(value ?? "");
  const localized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text.split("-").reverse().join("")
    : text;
  return localized.replace(/\D/g, "").slice(0, 8)
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2}\/\d{2})(\d)/, "$1/$2");
}

export function maskPlanilhaCompetence(value) {
  const text = String(value ?? "");
  if (/[^\d/\s]/.test(text)) return text;
  return text.replace(/\D/g, "").slice(0, 6).replace(/^(\d{2})(\d)/, "$1/$2");
}

export function maskPlanilhaDecimal(value, { percent = false, pad = false } = {}) {
  const text = String(value ?? "").trim();
  const sign = text.startsWith("-") ? "-" : "";
  const cleaned = text.replace(/[^\d.,]/g, "");
  if (!cleaned) return sign;
  const separator = cleaned.includes(",") ? "," : ".";
  const [whole, ...parts] = cleaned.split(separator);
  const integer = whole.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  const fraction = parts.join("").replace(/\D/g, "");
  const decimals = pad ? fraction.padEnd(percent ? 2 : 6, "0") : fraction;
  const number = `${sign}${integer}${parts.length || pad ? `,${decimals}` : ""}`;
  return `${number}${percent ? "%" : ""}`;
}

export function formatPlanilhaCell(value, format) {
  if (format === "currency") return value == null ? "" : currencyFormat.format(value);
  return value == null ? "" : String(value);
}

/**
 * Traduz as células digitadas para o modelo do motor. Células vazias ficam
 * `null` para que a coluna receba o neutro definido pela REGRA-DIF-004.
 *
 * As colunas B, H e K são percentuais na planilha (`12,33%`, `26,94%`,
 * `56,53%`) e o motor trabalha com frações, então são divididas por 100. A
 * coluna F já é um fator e entra como foi digitada.
 */
export function toEngineRows(rows) {
  return rows.map((row) => ({
    label: row.label,
    kind: row.kind,
    adjustmentRate: percentToRate(row.adjustment),
    correctionFactor: parsePlanilhaNumber(row.correction),
    interestRate: percentToRate(row.interest),
    selicRate: percentToRate(row.selic),
  }));
}

function percentToRate(text) {
  const parsed = parsePlanilhaNumber(text);
  return parsed == null ? null : parsed / 100;
}

export function evaluatePlanilhaSheet(sheet) {
  const baseReceived = parsePlanilhaNumber(sheet.baseReceived) ?? 0;
  const evaluation = buildSalaryPlanilhaSheet({ baseReceived, rows: toEngineRows(sheet.rows) });
  const issues = findSalaryPlanilhaIssues(evaluation, { firstRowNumber: PLANILHA_FIRST_ROW_NUMBER });
  return { ...evaluation, issues, baseReceived };
}

export function rowNumberAt(position) {
  return PLANILHA_FIRST_ROW_NUMBER + position;
}

/**
 * Competência de cada linha: rótulos como `ADIC. FÉRIAS` e `13.° SALÁRIO`
 * assumem a competência da linha anterior, como na planilha de referência.
 */
export function competenceOfRow(sheet, position) {
  let current = null;
  for (let index = 0; index <= position; index += 1) {
    const label = sheet.rows[index]?.label?.trim() ?? "";
    if (COMPETENCE_PATTERN.test(label)) current = label;
  }
  return current;
}

export function planilhaPeriod(sheet) {
  const competences = sheet.rows.map((_, position) => competenceOfRow(sheet, position)).filter(Boolean);
  if (!competences.length) return null;
  return { startDate: competenceToIso(competences[0], 1), endDate: competenceToIso(competences.at(-1), 0) };
}

function competenceToIso(competence, fallbackDay) {
  const [month, year] = competence.split("/");
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return `${year}-${month}-${String(fallbackDay || lastDay).padStart(2, "0")}`;
}

export function buildPlanilhaResult({ sheet, evaluation }) {
  const period = planilhaPeriod(sheet);
  const principalInCents = toCents(evaluation.difference);
  const correctedInCents = toCents(evaluation.payable);
  return {
    type: "salary",
    principalInCents,
    indexSlug: sheet.indexSlug,
    startDate: period.startDate,
    endDate: period.endDate,
    accumulatedFactor: 1,
    correctedInCents,
    correctionInCents: correctedInCents - principalInCents,
    traceabilityRuleId: PLANILHA_RULE_ID,
    months: evaluation.rows.map((cell, position) => ({
      referenceDate: null,
      competence: competenceOfRow(sheet, position) ?? cell.label ?? "Sem competência",
      description: cell.label || "Diferença remuneratória",
      dueInCents: toCents(cell.due),
      receivedInCents: toCents(cell.received),
      differenceInCents: toCents(cell.difference),
      correctionFactor: cell.correctionFactor,
      correctedInCents: toCents(cell.corrected),
      interestRate: cell.interestRate,
      interestInCents: toCents(cell.interest),
      selicRate: cell.selicRate,
      selicInCents: toCents(cell.selic),
      totalInCents: toCents(cell.total),
      correctionOnlyInCents: toCents(cell.correctionOnly),
    })),
    params: {
      calculationMode: "detailed",
      summary: {
        dueInCents: toCents(evaluation.totals.due),
        receivedInCents: toCents(evaluation.totals.received),
        monetaryCorrectionInCents: toCents(evaluation.totals.correctionOnly),
        interestInCents: toCents(evaluation.totals.interest),
        selicInCents: toCents(evaluation.totals.selic),
      },
      sheet: {
        baseReceived: sheet.baseReceived,
        citationDate: sheet.citationDate || null,
        indexSlug: sheet.indexSlug,
        rows: sheet.rows.map(({ id, ...row }) => row),
      },
    },
  };
}

export function buildPlanilhaResultRows({ sheet, evaluation }) {
  return evaluation.rows.map((cell, position) => ({
    rowNumber: rowNumberAt(position),
    competence: competenceOfRow(sheet, position) ?? "—",
    description: cell.label || "—",
    due: currencyFormat.format(cell.due),
    received: currencyFormat.format(cell.received),
    difference: currencyFormat.format(cell.difference),
    corrected: currencyFormat.format(cell.corrected),
    interest: currencyFormat.format(cell.interest),
    selic: currencyFormat.format(cell.selic),
    total: currencyFormat.format(cell.total),
  }));
}

export function buildPlanilhaSummaryRows(evaluation) {
  const { totals } = evaluation;
  return [
    { cell: "I33", label: "VALOR DEVIDO DO SUBSÍDIO", value: totals.due },
    { cell: "I34", label: "VALOR RECEBIDO DO SUBSÍDIO", value: totals.received },
    { cell: "I35", label: "VALOR DA CORREÇÃO", value: totals.correctionOnly },
    { cell: "I36", label: "VALOR DOS JUROS", value: totals.interest },
    { cell: "I37", label: "VALOR DA SELIC", value: totals.selic },
    { cell: "I38", label: "VALOR A SER PAGO", value: totals.payable, total: true },
  ];
}

/**
 * Repasse dos lançamentos do assistente para a grade. Os valores devido e
 * recebido não seguem porque a planilha os deriva das próprias células.
 */
export function planilhaFromWizardForm(form) {
  return createPlanilhaSheet({
    title: form.title ?? "",
    baseReceived: form.salaryPrevious ?? "",
    citationDate: form.citationDate ?? "",
    indexSlug: form.index === "IPCA (IBGE)" ? "ipca" : form.index === "INPC (IBGE)" ? "inpc" : form.index === "IGP-M (FGV)" ? "igp_m" : form.index === "TR (Bacen)" ? "tr" : "ipca_e",
    clientId: form.clientId ?? "",
    processId: form.processId ?? "",
    rows: (form.salaryEntries ?? []).map((entry, index) => createPlanilhaRow({
      label: entry.competence?.trim() ?? "",
      kind: wizardRowKind(entry, index),
      adjustment: wizardAdjustment(entry),
    })),
  });
}

function wizardRowKind(entry, index) {
  if (index === 0) return PLANILHA_ROW_KINDS.BASE;
  if (entry.description === "Adicional de férias") return PLANILHA_ROW_KINDS.FRACTION;
  return PLANILHA_ROW_KINDS.MONTHLY;
}

function wizardAdjustment(entry) {
  if (entry.description === "Adicional de férias") return entry.vacationPercentage || "";
  return entry.adjustmentPercentage || "";
}
