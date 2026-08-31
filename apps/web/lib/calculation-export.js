import { downloadFile, formatCurrency, formatFactor, safeSlug } from "./api";

const slugLabels = {
  ipca: "IPCA (IBGE)",
  ipca_e: "IPCA-E (IBGE)",
  inpc: "INPC (IBGE)",
  igp_m: "IGP-M (FGV)",
  tr: "TR (Bacen)",
  selic: "Taxa Selic (Bacen)",
};

export function indexLabel(slug) {
  return slugLabels[slug] ?? String(slug ?? "").toUpperCase();
}

function dateText(value) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function competenceShort(value) {
  const date = new Date(value);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export function buildCalculationCsv(calculation) {
  const label = calculation.indexSlug ? indexLabel(calculation.indexSlug) : "Sem correção";
  const lines = [
    `Cálculo;${calculation.title}`,
    `Tipo;${calculation.calculationType}`,
    `Indexador;${label}`,
    `Período;${dateText(calculation.startDate)} a ${dateText(calculation.endDate)}`,
    `Valor original;${formatCurrency(calculation.principalInCents)}`,
    `Fator acumulado;${formatFactor(calculation.accumulatedFactor)}`,
    `Valor corrigido;${formatCurrency(calculation.correctedInCents)}`,
    `Regra aplicada;${calculation.traceabilityRuleId ?? "—"}`,
  ];
  const installments = calculation.installments ?? [];
  if (installments.length > 0) {
    lines.push(
      "",
      "Parcela;Competência;Amortização;Juros;Prestação;Saldo devedor",
      ...installments.map((installment) =>
        [
          String(installment.installmentNumber).padStart(2, "0"),
          installment.competence ? competenceShort(installment.competence) : "—",
          formatCurrency(installment.amortizationInCents),
          formatCurrency(installment.interestInCents),
          formatCurrency(installment.installmentInCents),
          formatCurrency(installment.remainingInCents),
        ].join(";"),
      ),
      `TOTAL;—;${formatCurrency(calculation.principalInCents)};${formatCurrency((calculation.correctedInCents ?? 0) - calculation.principalInCents)};${formatCurrency(calculation.correctedInCents)};—`,
    );
  } else {
    lines.push(
      "",
      "Competência;Descritivo;Valor;Fator;Fator acumulado;Valor corrigido",
      ...(calculation.months ?? []).map((month) =>
        [
          month.competence,
          `Correção monetária — ${label}`,
          formatCurrency(calculation.principalInCents),
          formatFactor(month.factor),
          formatFactor(month.accumulatedFactor),
          formatCurrency(month.correctedInCents),
        ].join(";"),
      ),
      `TOTAL;Valor atualizado no fim do período;${formatCurrency(calculation.principalInCents)};—;${formatFactor(calculation.accumulatedFactor)};${formatCurrency(calculation.correctedInCents)}`,
    );
  }
  lines.push("", `Emitido em;${new Date().toLocaleString("pt-BR")}`, `Regra;${calculation.traceabilityRuleId}`);
  return lines.join("\n");
}

export function downloadCalculationCsv(calculation) {
  const csv = `\uFEFF${buildCalculationCsv(calculation)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeSlug(calculation.title)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadCalculationPdf(calculation) {
  return downloadFile(`/api/calculations/${calculation.id}/export?format=pdf`, `${safeSlug(calculation.title)}.pdf`);
}