"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Calculator, CheckCircle2, Clock3, FileStack } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { api, formatDate } from "../../lib/api";

export default function DashboardPage() {
  const calculations = useQuery({ queryKey: ["dashboard-calculations"], queryFn: () => api.get("/api/calculations") });
  const processes = useQuery({ queryKey: ["dashboard-processes"], queryFn: () => api.get("/api/processes") });
  const indices = useQuery({ queryKey: ["dashboard-indices"], queryFn: () => api.get("/api/indices") });
  const calculationRows = calculations.data ?? [];
  const processRows = processes.data ?? [];
  const indexRows = indices.data ?? [];
  const inProgress = calculationRows.filter((item) => !isCompleted(item.status)).length;
  const completed = calculationRows.filter((item) => isCompleted(item.status)).length;
  const activeProcesses = processRows.filter((item) => !isCompleted(item.status)).length;
  const monthCompleted = calculationRows.filter((item) => isCurrentMonth(item.createdAt) && isCompleted(item.status)).length;
  const updatedToday = processRows.filter((item) => isToday(item.updatedAt)).length;

  return <AppShell><section className="workspace module-workspace">
    <header className="module-header">
      <div>
        <span className="module-eyebrow">VISÃO GERAL</span>
        <h1>Olá, Fernando</h1>
        <p>Acompanhe os cálculos, processos e índices econômicos.</p>
      </div>
      {/* <Link className="primary-button module-action" href="/calculos/novo">
        <Calculator size={17} /> Novo cálculo
      </Link> */}
    </header>
    {calculations.isLoading || processes.isLoading || indices.isLoading ? <DashboardSkeleton /> : <>
      <div className="dashboard-cards">
        <Metric icon={Clock3} label="Em andamento" value={queryValue(calculations, inProgress)} detail={`${inProgress} aguardam conclusão`} />
        <Metric icon={CheckCircle2} label="Concluídos" value={queryValue(calculations, completed)} detail={`${monthCompleted} neste mês`} tone="green" />
        <Metric icon={FileStack} label="Processos ativos" value={queryValue(processes, activeProcesses)} detail={`${updatedToday} atualizados hoje`} />
        <Metric icon={BarChart3} label="Índices monitorados" value={queryValue(indices, indexRows.length)} detail={indexRows.length ? "Dados mais recentes" : "Nenhum índice cadastrado"} tone="green" />
      </div>
      <div className="dashboard-grid">
        <section className="data-card"><div className="card-heading"><div><h2>Cálculos recentes</h2><p>Últimas movimentações registradas</p></div><Link href="/calculos">Ver todos <ArrowRight size={15} /></Link></div>
          <div className="recent-list">{calculations.isLoading ? <Empty text="Carregando cálculos..." /> : calculationRows.slice(0, 5).map((item) => <RecentCalculation item={item} key={item.id} />)}{!calculations.isLoading && !calculationRows.length && <Empty text="Nenhum cálculo cadastrado." />}</div>
        </section>
        <aside className="data-card index-summary"><div className="card-heading"><div><h2>Índices econômicos</h2><p>Competência mais recente</p></div></div>
          {indices.isLoading ? <Empty text="Carregando índices..." /> : indexRows.slice(0, 5).map((item) => <IndexLine index={item} key={item.id} />)}{!indices.isLoading && !indexRows.length && <Empty text="Nenhum índice cadastrado." />}
          <Link className="text-link" href="/indices">Consultar histórico <ArrowRight size={15} /></Link>
        </aside>
      </div>
    </>}
  </section></AppShell>;
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" aria-label="Carregando painel" role="status" aria-live="polite">
    <div className="dashboard-cards">{Array.from({ length: 4 }, (_, index) => <span className="skeleton dashboard-metric-skeleton" key={index} />)}</div>
    <div className="dashboard-grid">
      <section className="data-card dashboard-panel-skeleton"><div className="card-heading"><span className="skeleton skeleton-heading" /><span className="skeleton skeleton-link" /></div>{Array.from({ length: 5 }, (_, index) => <div className="skeleton dashboard-list-skeleton" key={index} />)}</section>
      <aside className="data-card dashboard-panel-skeleton"><div className="card-heading"><span className="skeleton skeleton-heading" /></div>{Array.from({ length: 5 }, (_, index) => <div className="skeleton dashboard-list-skeleton" key={index} />)}</aside>
    </div>
  </div>;
}

function RecentCalculation({ item }) {
  const status = item.status ?? "Em andamento";
  return <article><div><strong>{item.title}</strong><span>{item.calculationType}</span></div><span className={`status-pill ${isCompleted(status) ? "success" : "warning"}`}>{status}</span><time>{relativeDate(item.updatedAt ?? item.createdAt)}</time></article>;
}

function IndexLine({ index }) {
  const value = index.values?.[0];
  return <div className="index-line"><span>{index.name}</span><strong>{formatPercent(value?.monthlyValue)}</strong></div>;
}

function Metric({ icon: Icon, label, value, detail, tone = "orange" }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}><Icon size={22} /></span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function Empty({ text }) { return <div className="dashboard-empty">{text}</div>; }
function queryValue(query, value) { return query.isLoading || query.isError ? "—" : String(value); }
function isCompleted(status) { return String(status ?? "").toLowerCase().includes("conclu"); }
function isToday(value) { return value ? new Date(value).toDateString() === new Date().toDateString() : false; }
function isCurrentMonth(value) { const date = value ? new Date(value) : null; const now = new Date(); return Boolean(date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()); }
function relativeDate(value) { if (!value) return "—"; const date = new Date(value); if (Number.isNaN(date.getTime())) return formatDate(value); if (isToday(value)) return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; return formatDate(value); }
function formatPercent(value) { if (value == null || value === "") return "—"; const numeric = Number(value); return Number.isFinite(numeric) ? `${numeric.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%` : "—"; }
