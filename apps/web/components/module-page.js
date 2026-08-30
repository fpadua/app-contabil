"use client";

import { useMemo, useState } from "react";
import { Download, Plus, RefreshCw, Search } from "lucide-react";

export function ModulePage({ eyebrow, title, description, actionLabel, columns, rows, stats = [], actionIcon = "plus" }) {
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalized)));
  }, [query, rows]);
  const ActionIcon = actionIcon === "refresh" ? RefreshCw : actionIcon === "download" ? Download : Plus;

  return (
    <section className="workspace module-workspace">
      <header className="module-header">
        <div><span className="module-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
        <button className="primary-button module-action" type="button"><ActionIcon size={17} /> {actionLabel}</button>
      </header>

      {stats.length > 0 && <div className="stat-grid">
        {stats.map((stat) => <article className="stat-card" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.hint}</small></article>)}
      </div>}

      <div className="data-card">
        <div className="data-toolbar">
          <div className="search-field"><Search size={17} /><input aria-label={`Buscar em ${title}`} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." value={query} /></div>
          <span>{filteredRows.length} registro{filteredRows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="table-scroll">
          <div className="data-table" role="table" style={{ "--columns": columns.map((column) => column.width ?? "1fr").join(" ") }}>
            <div className="data-row data-head" role="row">{columns.map((column) => <span key={column.key}>{column.label}</span>)}</div>
            {filteredRows.map((row) => <div className="data-row" role="row" key={row.id}>{columns.map((column) => <span key={column.key} className={column.key === "status" ? `status-pill ${statusClass(row[column.key])}` : ""}>{row[column.key]}</span>)}</div>)}
          </div>
        </div>
        {filteredRows.length === 0 && <div className="empty-state"><Search size={28} /><strong>Nenhum registro encontrado</strong><span>Tente outro termo de busca.</span></div>}
      </div>
    </section>
  );
}

function statusClass(value) {
  const normalized = String(value).toLocaleLowerCase("pt-BR");
  if (normalized.includes("conclu") || normalized.includes("atualizado") || normalized.includes("validado") || normalized.includes("ativo")) return "success";
  if (normalized.includes("pendente") || normalized.includes("andamento") || normalized.includes("revisão")) return "warning";
  return "neutral";
}
