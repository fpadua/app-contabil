import { Info, ShieldCheck } from "lucide-react";
import { formatCurrency, formatFactor } from "../lib/api";

const previewCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function SummaryCard({ form, step, result }) {
  const data = result?.data;
  const principal = data ? data.principalInCents : principalPreview(form);
  const corrected = data ? data.correctedInCents : null;
  const factor = data ? data.accumulatedFactor : null;
  const variation = factor ? (factor - 1) * 100 : null;
  const isSchedule = form.type === "sac" || form.type === "price";
  const interestLine = isSchedule ? `${form.interest}% a.m.` : "—";

  return (
    <aside className="summary-card">
      <h2>Resumo do cálculo</h2>
      <dl>
        <div><dt>Tipo de cálculo</dt><dd className="accent">{form.typeLabel}</dd></div>
        <div><dt>{form.type === "salary" ? "Diferença mensal" : "Valor original"}</dt><dd>{previewCurrency.format(principal / 100)}</dd></div>
        <div><dt>Período</dt><dd>{form.startDate} a {form.endDate}</dd></div>
        <div><dt>Indexador</dt><dd>{form.index}</dd></div>
      </dl>
      <div className="estimate-title">Resumo do período <Info size={14} /></div>
      <dl className="estimate-list">
        <div><dt>Índice acumulado</dt><dd>{factor ? formatFactor(factor) : "—"}</dd></div>
        <div><dt>Variação do período</dt><dd>{variation !== null ? `${variation.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%` : "—"}</dd></div>
        <div><dt>Valor corrigido</dt><dd className="positive">{corrected ? formatCurrency(corrected) : "—"}</dd></div>
        <div><dt>Juros</dt><dd>{interestLine}</dd></div>
      </dl>
      <div className="total-box"><span>Total estimado</span><strong>{previewCurrency.format((corrected ?? principal) / 100)}</strong></div>
      <div className="notice"><ShieldCheck size={18} /><p>{step === 4 ? "Resultado preparado com memória e trilha de auditoria." : "Esta é uma prévia. O resultado final considera as regras confirmadas nas próximas etapas."}</p></div>
    </aside>
  );
}

function principalPreview(form) {
  if (form.type === "salary") {
    const previous = Number(form.salaryPrevious?.replace(/\D/g, "")) || 0;
    const current = Number(form.salaryNew?.replace(/\D/g, "")) || 0;
    return Math.max(current - previous, 0);
  }
  return Number(form.amount?.replace(/\D/g, "")) || 0;
}