import Link from "next/link";
import { ArrowRight, BarChart3, Calculator, CheckCircle2, Clock3, FileStack } from "lucide-react";
import { AppShell } from "../../components/app-shell";

const recentCalculations = [
  ["Revisão contratual — Contrato 2021", "Correção monetária", "Em andamento", "Hoje, 10:32"],
  ["Diferenças salariais — Processo 042", "Diferença salarial", "Concluído", "Ontem, 16:05"],
  ["Financiamento habitacional", "Financiamento SAC", "Em revisão", "28/08/2026"],
];

export default function DashboardPage() {
  return <AppShell><section className="workspace module-workspace">
    <header className="module-header"><div><span className="module-eyebrow">VISÃO GERAL</span><h1>Olá, Fernando</h1><p>Acompanhe os cálculos, processos e índices econômicos.</p></div><Link className="primary-button module-action" href="/calculos/novo"><Calculator size={17} /> Novo cálculo</Link></header>
    <div className="dashboard-cards">
      <Metric icon={Clock3} label="Em andamento" value="7" detail="2 aguardam conferência" />
      <Metric icon={CheckCircle2} label="Concluídos" value="42" detail="6 neste mês" tone="green" />
      <Metric icon={FileStack} label="Processos ativos" value="18" detail="3 atualizados hoje" />
      <Metric icon={BarChart3} label="Índices monitorados" value="5" detail="Todos atualizados" tone="green" />
    </div>
    <div className="dashboard-grid">
      <section className="data-card"><div className="card-heading"><div><h2>Cálculos recentes</h2><p>Últimas movimentações registradas</p></div><Link href="/processos">Ver todos <ArrowRight size={15} /></Link></div>
        <div className="recent-list">{recentCalculations.map(([name,type,status,date]) => <article key={name}><div><strong>{name}</strong><span>{type}</span></div><span className={`status-pill ${status === "Concluído" ? "success" : "warning"}`}>{status}</span><time>{date}</time></article>)}</div>
      </section>
      <aside className="data-card index-summary"><div className="card-heading"><div><h2>Índices econômicos</h2><p>Competência mais recente</p></div></div>
        {[['IPCA','0,07%'],['INPC','-0,01%'],['IGP-M','-1,16%'],['Selic','1,22%'],['TR','0,1693%']].map(([name,value]) => <div className="index-line" key={name}><span>{name}</span><strong>{value}</strong></div>)}
        <Link className="text-link" href="/indices">Consultar histórico <ArrowRight size={15} /></Link>
      </aside>
    </div>
  </section></AppShell>;
}

function Metric({ icon: Icon, label, value, detail, tone = "orange" }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}><Icon size={22} /></span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}
