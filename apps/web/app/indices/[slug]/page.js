"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Table2 } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { api, formatRequired } from "../../../lib/api";

export default function IndexDetailPage() {
  const { slug } = useParams();
  const detail = useQuery({ queryKey: ["economic-index", slug], queryFn: () => api.get(`/api/indices/${slug}`), enabled: Boolean(slug) });
  const index = detail.data;

  const byYear = index ? buildYearGrid(index.values ?? []) : [];
  const published = (index?.values ?? []).filter((value) => value.published);
  const totalValues = published.length;
  const latest = published.at(-1) ?? null;

  return (
    <AppShell>
      <section className="workspace module-workspace">
        <Link className="record-back" href="/indices"><ArrowLeft size={16} /> Voltar para Índices econômicos</Link>

        {index && (
          <header className="module-header">
            <div><span className="module-eyebrow">SÉRIE ECONÔMICA</span><h1>{index.name}</h1><p>{formatRequired(index.source)} · {totalValues} competências</p></div>
            <div className="top-actions module-actions"><span className={`status-pill ${index.origin === "IMPORTED" ? "success" : "neutral"}`}>{index.origin === "IMPORTED" ? "Importado" : "Site"}</span></div>
          </header>
        )}

        {detail.isLoading && <div className="module-status" role="status">Carregando série econômica...</div>}
        {detail.isError && <div className="module-status error" role="status">Não foi possível carregar o índice. Verifique se a API está em execução.</div>}

        {index && (
          <div className="data-card">
            <div className="card-heading"><div><h2>Tabela de variações mensais</h2><p>Anos × meses — valores de variação percentual mensal</p></div><Table2 size={18} /></div>
            {byYear.length === 0 ? (
              <p className="empty-state"><Table2 size={28} /><strong>Sem competências</strong><span>Este índice ainda não possui valores. Atualize-o ou importe um PDF.</span></p>
            ) : (
              <div className="table-scroll">
                <div className="index-grid" role="table">
                  <div className="index-grid-row index-grid-head" role="row">
                    <span className="index-grid-year" role="columnheader">Ano</span>
                    {MONTH_LABELS.map((label, month) => <span key={month} role="columnheader">{label}</span>)}
                  </div>
                  {byYear.map((year) => (
                    <div className="index-grid-row" key={year.year} role="row">
                      <span className="index-grid-year" role="rowheader">{year.year}</span>
                      {MONTH_LABELS.map((label, month) => {
                        const cell = year.months[month];
                        return <span className={cell === undefined ? "index-grid-empty" : Number(cell.value) < 0 ? "negative" : ""} key={label}>{cell?.display ?? "—"}</span>;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {latest && <div className="card-foot"><span>Última competência: <strong>{formatPeriod(latest.referenceDate)}</strong> · variação mensal <strong>{latest.monthlyValue < 0 ? <span className="negative">{formatDecimal(latest.monthlyValue, "%")}</span> : formatDecimal(latest.monthlyValue, "%")}</strong></span></div>}
          </div>
        )}
      </section>
    </AppShell>
  );
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function buildYearGrid(values) {
  const rows = new Map();
  for (const value of values) {
    const [year, month] = String(value.referenceDate).slice(0, 7).split("-").map(Number);
    if (!year) continue;
    if (!rows.has(year)) rows.set(year, { year, months: new Array(12).fill(undefined) });
    rows.get(year).months[month - 1] = { value: value.monthlyValue, display: formatDecimal(value.monthlyValue) };
  }
  return [...rows.values()];
}

function formatPeriod(value) {
  const [year, month] = String(value).slice(0, 7).split("-");
  return `${month}/${year}`;
}

function formatDecimal(value, suffix = "") {
  if (value === null || value === undefined || value === "") return undefined;
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${suffix}`;
}
