import { chromium } from "playwright";

const slugLabels = {
  ipca: "IPCA (IBGE)",
  ipca_e: "IPCA-E (IBGE)",
  inpc: "INPC (IBGE)",
  igp_m: "IGP-M (FGV)",
  tr: "TR (Bacen)",
  selic: "Taxa Selic (Bacen)",
};

export function indexLabelForSlug(slug) {
  return slugLabels[slug] ?? String(slug).toUpperCase();
}

export function slugFileName(title) {
  const normalized = String(title ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "memoria-de-calculo";
}

export function buildCalculationPdfHtml(calculation, { issuedAt = new Date() } = {}) {
  const lines = contentLines(calculation);
  const parameters = [
    ["Título", calculation.title],
    ["Cliente", calculation.client?.name ?? "—"],
    ["Processo", calculation.process ? `${calculation.process.title}${calculation.process.number ? ` (${calculation.process.number})` : ""}` : "—"],
    ["Tipo de cálculo", calculation.calculationType],
    ["Indexador", lines.label],
    ["Período", `${dateStamp(calculation.startDate)} a ${dateStamp(calculation.endDate)}`],
    ["Valor original", currencyBr(calculation.principalInCents)],
    ["Fator acumulado", factorBr(calculation.accumulatedFactor)],
    ["Valor corrigido", currencyBr(calculation.correctedInCents)],
    ["Regra aplicada", `${calculation.traceabilityRuleId} (versão validada)`],
  ];
  const memory = lines.rows.length
    ? memoryTable(lines.rows.concat(lines.total), lines.schedule)
    : `<p class="muted">Este cálculo foi salvo sem memória de competências (fator informado diretamente).</p>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Memória de cálculo — ${escapeHtml(calculation.title)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; color: #242422; font: 10.5px/1.45 Georgia, "Times New Roman", serif; }
  .sheet { padding: 28px 34px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #ba5432; padding-bottom: 12px; }
  .brand { font-size: 22px; font-weight: 700; color: #9b4126; }
  .brand small { display: block; font: 7.5px/1.3 Arial, sans-serif; color: #777; letter-spacing: .18em; }
  .doc-id { font: 8px Arial, sans-serif; color: #777; text-align: right; }
  h1 { margin: 22px 0 4px; font-size: 18px; }
  .subhead { margin: 0 0 18px; color: #777; font: 10px Arial, sans-serif; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; border: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { background: #f6f3ee; font: 700 9px Arial, sans-serif; text-transform: uppercase; letter-spacing: .04em; }
  .key-col { width: 30%; color: #5c5853; }
  thead th { border-top: 2px solid #c9a18f; }
  tr.total td { font-weight: 700; background: #faf6f1; }
  tr.total td:first-child { color: #9b4126; }
  .num { text-align: right; white-space: nowrap; }
  .schedule th, .schedule td { padding: 4px 7px; }
  h2 { margin: 22px 0 10px; font: 700 13px Arial, sans-serif; }
  .muted { color: #888; }
  footer { position: fixed; bottom: -14mm; left: 34px; right: 34px; border-top: 1px solid #eee; padding-top: 6px; font: 8px Arial, sans-serif; color: #999; display: flex; justify-content: space-between; }
</style>
</head>
<body><div class="sheet">
  <header>
    <div class="brand">Contábil<small>CÁLCULOS CONTÁBEIS E JUDICIAIS</small></div>
    <div class="doc-id">Documento gerado em ${dateStamp(issuedAt)}</div>
  </header>
  <h1>Memória de cálculo</h1>
  <p class="subhead">${lines.schedule ? "Documento de apoio com a memória de amortização contratual." : "Documento de apoio com a memória mensal da atualização monetária."}</p>
  <table><tbody>
    ${parameters.map(([label, value]) => `<tr><td class="key-col">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("\n    ")}
  </tbody></table>
  <h2>${lines.schedule ? "Memória de amortização" : "Memória do período"}</h2>
  ${memory}
  <footer>
    <span>Regra ${escapeHtml(calculation.traceabilityRuleId)} — validação por tabela de rastreabilidade</span>
    <span>Contábil · cálculo id ${escapeHtml(calculation.id)}</span>
  </footer>
</div></body></html>`;
}

function contentLines(calculation) {
  const label = calculation.indexSlug ? indexLabelForSlug(calculation.indexSlug) : "Sem correção";
  const installments = calculation.installments ?? [];
  if (installments.length > 0) {
    const rows = installments.map((row) => ({
      competence: row.competence ? competenceShort(row.competence) : String(row.installmentNumber).padStart(2, "0"),
      description: "Parcela",
      amount: currencyBr(row.amortizationInCents),
      factor: currencyBr(row.interestInCents),
      accumulated: currencyBr(row.installmentInCents),
      corrected: currencyBr(row.remainingInCents),
      kind: "schedule",
    }));
    const totalInterest = installments.reduce((sum, row) => sum + row.interestInCents, 0);
    return {
      label,
      schedule: true,
      rows,
      total: {
        competence: "TOTAL",
        description: "Total amortizado",
        amount: currencyBr(calculation.principalInCents),
        factor: currencyBr(totalInterest),
        accumulated: currencyBr(calculation.correctedInCents),
        corrected: "—",
        kind: "schedule",
      },
    };
  }
  const rows = (calculation.months ?? []).map((month) => ({
    competence: month.competence,
    description: `Correção monetária — ${label}`,
    amount: currencyBr(calculation.principalInCents),
    factor: factorBr(month.factor),
    accumulated: factorBr(month.accumulatedFactor),
    corrected: currencyBr(month.correctedInCents),
    kind: "months",
  }));
  return {
    label,
    schedule: false,
    rows,
    total: {
      competence: "TOTAL",
      description: "Valor atualizado no fim do período",
      amount: currencyBr(calculation.principalInCents),
      factor: "—",
      accumulated: factorBr(calculation.accumulatedFactor),
      corrected: currencyBr(calculation.correctedInCents),
      kind: "months",
    },
  };
}

function memoryTable(rows, schedule) {
  const head = schedule
    ? `<thead><tr><th>Parcela</th><th class="num">Amortização</th><th class="num">Juros</th><th class="num">Prestação</th><th class="num">Saldo devedor</th></tr></thead>`
    : `<thead><tr><th>Competência</th><th>Descritivo</th><th class="num">Valor</th><th class="num">Fator</th><th class="num">Fator acumulado</th><th class="num">Valor corrigido</th></tr></thead>`;
  const body = rows.map((row) => `<tr class="${row.competence === "TOTAL" ? "total" : ""}">
    ${schedule
      ? `<td>${escapeHtml(row.competence)}</td><td class="num">${escapeHtml(row.amount)}</td><td class="num">${escapeHtml(row.factor)}</td><td class="num">${escapeHtml(row.accumulated)}</td><td class="num">${escapeHtml(row.corrected)}</td>`
      : `<td>${escapeHtml(row.competence)}</td>
    <td>${escapeHtml(row.description)}</td>
    <td class="num">${escapeHtml(row.amount)}</td>
    <td class="num">${escapeHtml(row.factor)}</td>
    <td class="num">${escapeHtml(row.accumulated)}</td>
    <td class="num">${escapeHtml(row.corrected)}</td>`}
  </tr>`).join("\n    ");
  return `<table class="${schedule ? "schedule" : ""}">${head}<tbody>${body}</tbody></table>`;
}

export async function exportCalculationPdf(calculation, { launchBrowser = (options) => chromium.launch(options), issuedAt } = {}) {
  const browser = await launchBrowser({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(buildCalculationPdfHtml(calculation, { issuedAt }), { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", right: "12mm", bottom: "16mm", left: "12mm" },
    });
  } finally {
    await browser.close();
  }
}

function currencyBr(cents) {
  return Number(cents).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function factorBr(value) {
  return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function dateStamp(value) {
  const date = new Date(value);
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function competenceShort(value) {
  const date = new Date(value);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}