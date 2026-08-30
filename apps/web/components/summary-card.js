import { Info, ShieldCheck } from "lucide-react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function SummaryCard({ form, step }) {
  const principal = Number(form.amount.replace(/\D/g, "")) / 100 || 0;
  const factor = 1.097519;
  const corrected = principal * factor;

  return (
    <aside className="summary-card">
      <h2>Resumo do cálculo</h2>
      <dl>
        <div><dt>Tipo de cálculo</dt><dd className="accent">{form.typeLabel}</dd></div>
        <div><dt>Valor original</dt><dd>{currency.format(principal)}</dd></div>
        <div><dt>Período</dt><dd>{form.startDate} a {form.endDate}</dd></div>
        <div><dt>Indexador</dt><dd>{form.index}</dd></div>
      </dl>
      <div className="estimate-title">Resumo estimado <Info size={14} /></div>
      <dl className="estimate-list">
        <div><dt>Índice acumulado</dt><dd>{factor.toFixed(6).replace(".", ",")}</dd></div>
        <div><dt>Variação do período</dt><dd>9,7519%</dd></div>
        <div><dt>Valor corrigido</dt><dd className="positive">{currency.format(corrected)}</dd></div>
        <div><dt>Juros ({form.interest}% a.m.)</dt><dd>{currency.format(0)}</dd></div>
      </dl>
      <div className="total-box"><span>Total estimado</span><strong>{currency.format(corrected)}</strong></div>
      <div className="notice"><ShieldCheck size={18} /><p>{step === 4 ? "Resultado preparado com memória e trilha de auditoria." : "Esta é uma prévia. O resultado final considera as regras confirmadas nas próximas etapas."}</p></div>
    </aside>
  );
}
