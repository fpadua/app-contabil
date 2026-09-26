"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Calculator, FileDown, Info, Plus, RefreshCw, Save } from "lucide-react";
import { formatHousingCurrency, maskHousingCurrency, maskHousingPercent, parseHousingNumber, calculateHousingSchedule } from "../lib/housing-planilha";
import { api } from "../lib/api";

const initial = { title: "", principal: "", months: "", monthlyRate: "", startDate: "", insurance: "", fee: "", other: "" };

export function HousingPlanilha() {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [showAll, setShowAll] = useState(false);
  const [status, setStatus] = useState(null);
  const [revision, setRevision] = useState(0);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const ready = parseHousingNumber(form.principal) > 0 && Number(form.months) > 0 && /^\d{2}\/\d{2}\/\d{4}$/.test(form.startDate);
  const schedule = useMemo(() => ready ? calculateHousingSchedule({ principal: parseHousingNumber(form.principal), months: Number(form.months), monthlyRate: parseHousingNumber(form.monthlyRate) / 100, startDate: toIsoDate(form.startDate), insurance: parseHousingNumber(form.insurance), fee: parseHousingNumber(form.fee), other: parseHousingNumber(form.other) }) : { rows: [], amortization: 0, totalInterest: 0, totalPaid: 0 }, [form, ready, revision]);
  const rows = showAll ? schedule.rows : schedule.rows.slice(0, 24);
  const save = useMutation({
    mutationFn: () => api.post("/api/calculations", { title: form.title.trim() || "Financiamento habitacional SAC", calculationType: "Financiamento SAC", result: buildSaveResult(form, schedule) }),
    onSuccess: (data) => router.push(`/calculos/${data.id}`),
    onError: (error) => setStatus(error.message),
  });
  const reset = () => { setForm(initial); setShowAll(false); setStatus(null); setRevision((value) => value + 1); };
  return <section className="workspace planilha-workspace">
    <header className="topbar"><div><div className="module-eyebrow">MODELO SAC HABITACIONAL</div><h1>Planilha de financiamento SAC</h1><p>Reproduza a memória de cálculo habitacional com amortização constante, juros, seguros e encargos mensais.</p></div><div className="top-actions"><button className="secondary-button" type="button" onClick={reset}><Plus size={17} /> Novo</button><button className="secondary-button" type="button" onClick={() => setRevision((value) => value + 1)} disabled={!ready}><RefreshCw size={17} /> Recalcular</button><button className="secondary-button" type="button" disabled={!ready}><FileDown size={17} /> Baixar CSV</button><button className="primary-button" disabled={save.isPending || !ready} onClick={() => save.mutate()} type="button"><Save size={17} /> {save.isPending ? "Salvando..." : "Salvar cálculo"}</button></div></header>
    {status && <div className="module-status error" role="alert">{status}</div>}
    <div className="planilha-setup housing-setup">
      <label className="field"><span>Título do cálculo</span><input value={form.title} onChange={(event) => update("title", event.target.value)} /></label>
      <label className="field"><span>Saldo devedor inicial</span><input inputMode="numeric" value={form.principal} onChange={(event) => update("principal", maskHousingCurrency(event.target.value))} /></label>
      <label className="field"><span>Quantidade de parcelas</span><input inputMode="numeric" value={form.months} onChange={(event) => update("months", event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
      <label className="field"><span>Juros mensais</span><input inputMode="decimal" value={form.monthlyRate} onChange={(event) => update("monthlyRate", maskHousingPercent(event.target.value))} /></label>
      <label className="field"><span>Primeiro vencimento</span><input placeholder="DD/MM/AAAA" value={form.startDate} onChange={(event) => update("startDate", maskDate(event.target.value))} /></label>
      <label className="field"><span>Seguro mensal</span><input inputMode="numeric" value={form.insurance} onChange={(event) => update("insurance", maskHousingCurrency(event.target.value))} /></label>
      <label className="field"><span>Tarifa mensal</span><input inputMode="numeric" value={form.fee} onChange={(event) => update("fee", maskHousingCurrency(event.target.value))} /></label>
      <label className="field"><span>Outros encargos</span><input inputMode="numeric" value={form.other} onChange={(event) => update("other", maskHousingCurrency(event.target.value))} /></label>
    </div>
    <div className="housing-summary"><div><span>Amortização mensal</span><strong>{formatHousingCurrency(schedule.amortization)}</strong></div><div><span>Total de juros</span><strong>{formatHousingCurrency(schedule.totalInterest)}</strong></div><div><span>Total projetado</span><strong>{formatHousingCurrency(schedule.totalPaid)}</strong></div></div>
    <div className="module-status"><Info size={15} /> O modelo BERNADETE usa 360 parcelas, vencimento no fim do mês e encargos separados da parcela SAC.</div>
    <div className="planilha-scroll housing-table"><table className="planilha"><thead><tr><th>Parcela</th><th>Vencimento</th><th>Amortização</th><th>Juros</th><th>Seguro</th><th>Tarifa</th><th>Outros</th><th>Total</th><th>Saldo</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.installment}><td>{row.installment}</td><td>{row.date}</td><td>{formatHousingCurrency(row.amortization)}</td><td>{formatHousingCurrency(row.interest)}</td><td>{formatHousingCurrency(row.insurance)}</td><td>{formatHousingCurrency(row.fee)}</td><td>{formatHousingCurrency(row.other)}</td><td><strong>{formatHousingCurrency(row.installmentTotal)}</strong></td><td>{formatHousingCurrency(row.balance)}</td></tr>) : <tr><td colSpan="9" className="housing-empty">Preencha os campos principais para visualizar o cálculo.</td></tr>}</tbody></table></div>
    <div className="housing-actions"><button className="add-rule-button" type="button" disabled={!schedule.rows.length} onClick={() => setShowAll((current) => !current)}><Calculator size={16} /> {showAll ? "Mostrar primeiras parcelas" : `Mostrar todas as ${schedule.rows.length} parcelas`}</button></div>
  </section>;
}

function buildSaveResult(form, schedule) {
  const startDate = toIsoDate(form.startDate);
  const end = new Date(`${startDate}T12:00:00`);
  end.setMonth(end.getMonth() + Number(form.months || 1) - 1);
  const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  const principalInCents = Math.round(parseHousingNumber(form.principal) * 100);
  const correctedInCents = Math.round(schedule.totalPaid * 100);
  return { type: "sac", principalInCents, indexSlug: null, startDate, endDate, accumulatedFactor: 1, correctedInCents, correctionInCents: correctedInCents - principalInCents, traceabilityRuleId: "REGRA-SAC-HABITACIONAL-001", installments: schedule.rows.map((row, index) => ({ installmentNumber: row.installment, competence: installmentDateIso(startDate, index), amortizationInCents: Math.round(row.amortization * 100), interestInCents: Math.round(row.interest * 100), installmentInCents: Math.round(row.installmentTotal * 100), remainingInCents: Math.round(row.balance * 100) })) };
}

function installmentDateIso(startDate, index) {
  const start = new Date(`${startDate}T12:00:00`);
  const date = index === 0 ? start : new Date(start.getFullYear(), start.getMonth() + index + 1, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function maskDate(value) { return String(value ?? "").replace(/\D/g, "").slice(0, 8).replace(/^(\d{2})(\d)/, "$1/$2").replace(/^(\d{2}\/\d{2})(\d)/, "$1/$2"); }
function toIsoDate(value) { const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return match ? `${match[3]}-${match[2]}-${match[1]}` : "2015-04-30"; }


