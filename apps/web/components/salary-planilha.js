"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, FileDown, Info, Loader2, Plus, Save, Table2, X } from "lucide-react";
import { SalaryPlanilhaGrid } from "./salary-planilha-grid";
import { api, formatCurrency } from "../lib/api";
import { downloadCalculationCsv } from "../lib/calculation-export";
import {
  PLANILHA_INDEX_OPTIONS,
  PLANILHA_RESULT_COLUMNS,
  PLANILHA_RULE_ID,
  PLANILHA_STORAGE_KEY,
  buildPlanilhaResult,
  buildPlanilhaResultRows,
  buildPlanilhaSummaryRows,
  createPlanilhaRow,
  createPlanilhaSheet,
  createIncidenceRule,
  applyIncidenceRules,
  calculateIncidenceBreakdown,
  calculateIncidenceFactor,
  incidenceIndexSlug,
  evaluatePlanilhaSheet,
  formatPlanilhaCurrencyInput,
  maskPlanilhaCompetence,
  maskPlanilhaCurrency,
  maskPlanilhaDate,
} from "../lib/planilha";

export function SalaryPlanilha() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const calculationId = searchParams.get("calculo");
  const [sheet, setSheet] = useState(createPlanilhaSheet);
  const [status, setStatus] = useState(null);
  const [statusTone, setStatusTone] = useState("info");
  const [issues, setIssues] = useState([]);
  const [incidenceDraft, setIncidenceDraft] = useState(createIncidenceRule);
  const [expandedRules, setExpandedRules] = useState(() => new Set());
  const [pendingDeleteRule, setPendingDeleteRule] = useState(null);

  const clients = useQuery({ queryKey: ["client-options"], queryFn: () => api.get("/api/clients/options") });
  const processes = useQuery({ queryKey: ["process-options"], queryFn: () => api.get("/api/processes/options") });
  const saved = useQuery({ queryKey: ["calculation", calculationId], queryFn: () => api.get(`/api/calculations/${calculationId}`), enabled: Boolean(calculationId) });
  const linksUnavailable = clients.isError || processes.isError;
  const incidenceSlugs = [...new Set((sheet.incidenceRules ?? []).map((rule) => incidenceIndexSlug(rule.index)))];
  const incidenceQueries = useQueries({ queries: incidenceSlugs.map((slug) => ({
    queryKey: ["economic-index", slug],
    queryFn: () => api.get(`/api/indices/${slug}`),
  })) });
  const incidenceReady = incidenceQueries.every((query) => query.isSuccess);
  const incidenceError = incidenceQueries.find((query) => query.isError)?.error;
  const indexValues = Object.fromEntries(incidenceSlugs.map((slug, index) => [slug, incidenceQueries[index]?.data?.values]));
  let appliedSheet = sheet;
  let ruleError = incidenceError;
  if (incidenceReady) {
    try {
      appliedSheet = applyIncidenceRules(sheet, indexValues);
    } catch (error) {
      ruleError = error;
    }
  }

  const evaluation = useMemo(() => evaluatePlanilhaSheet(appliedSheet), [appliedSheet]);
  const summaryRows = useMemo(() => buildPlanilhaSummaryRows(evaluation), [evaluation]);
  const resultRows = useMemo(() => buildPlanilhaResultRows({ sheet: appliedSheet, evaluation }), [appliedSheet, evaluation]);

  const showStatus = (message, tone = "info") => {
    setStatusTone(tone);
    setStatus(message);
  };
  const clearStatus = () => {
    setStatus(null);
    setStatusTone("info");
  };
  const update = (field, value) => {
    clearStatus();
    setSheet((current) => ({ ...current, [field]: value }));
  };
  const updateIncidenceDraft = (field, value) => {
    clearStatus();
    setIncidenceDraft((current) => ({ ...current, [field]: value }));
  };
  const [incidenceLoading, setIncidenceLoading] = useState(false);
  const addIncidenceRule = async () => {
    clearStatus();
    setIncidenceLoading(true);
    try {
      const slug = incidenceIndexSlug(incidenceDraft.index);
      const detail = await queryClient.fetchQuery({ queryKey: ["economic-index", slug], queryFn: () => api.get(`/api/indices/${slug}`) });
      const accumulated = calculateIncidenceFactor(detail.values, incidenceDraft.start, incidenceDraft.end, incidenceDraft.index);
      const next = createIncidenceRule({ index: incidenceDraft.index, start: incidenceDraft.start, end: incidenceDraft.end });
      setSheet((current) => ({ ...current, incidenceRules: [...(current.incidenceRules ?? []), next] }));
      setIncidenceDraft(createIncidenceRule());
      showStatus(`Regra adicionada. Acumulado do período: ${formatIncidenceAccumulated(accumulated, next.index)}. As taxas acompanham a competência de cada linha.`, "success");
    } catch (error) {
      showStatus(error.message, "error");
    } finally {
      setIncidenceLoading(false);
    }
  };
  const requestRemoveIncidenceRule = (rule) => {
    clearStatus();
    setPendingDeleteRule(rule);
  };
  const removeIncidenceRule = () => {
    if (!pendingDeleteRule) return;
    update("incidenceRules", (sheet.incidenceRules ?? []).filter((rule) => rule.id !== pendingDeleteRule.id));
    setExpandedRules((current) => {
      const next = new Set(current);
      next.delete(pendingDeleteRule.id);
      return next;
    });
    setPendingDeleteRule(null);
  };
  const toggleRuleDetails = (id) => {
    clearStatus();
    setExpandedRules((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const setRows = (rows) => {
    clearStatus();
    setSheet((current) => ({ ...current, rows }));
  };
  const duplicateRow = (index) => setRows([...sheet.rows.slice(0, index + 1), { ...sheet.rows[index], id: createPlanilhaRow().id }, ...sheet.rows.slice(index + 1)]);
  const removeRow = (index) => setRows(sheet.rows.filter((_, current) => current !== index));

  const save = useMutation({
    mutationFn: (payload) => api.post("/api/calculations", payload),
    onSuccess: (data) => router.push(`/calculos/${data.id}`),
    onError: (error) => showStatus(error.message, "error"),
  });

  useEffect(() => {
    const stored = window.sessionStorage.getItem(PLANILHA_STORAGE_KEY);
    if (!stored) return;
    window.sessionStorage.removeItem(PLANILHA_STORAGE_KEY);
      setSheet(readStoredSheet(stored, showStatus));
  }, []);

  useEffect(() => {
    const stored = saved.data?.params?.sheet;
    if (!stored) return;
    setSheet(createPlanilhaSheet({
      ...stored,
      title: saved.data.title,
      clientId: saved.data.clientId ?? "",
      processId: saved.data.processId ?? "",
      rows: (stored.rows ?? []).map((row) => createPlanilhaRow(row)),
    }));
  }, [saved.data]);

  useEffect(() => {
    if (!pendingDeleteRule) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setPendingDeleteRule(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingDeleteRule]);

  function buildSavePayload() {
    if (!incidenceReady || ruleError) {
      showStatus(ruleError?.message ?? "Aguarde a consulta dos índices para salvar a planilha.", "error");
      return null;
    }
    if (evaluation.issues.length) {
      setIssues(evaluation.issues);
      return null;
    }
    setIssues([]);
    return {
      title: sheet.title.trim() || "Diferença salarial — planilha",
      calculationType: "Diferença salarial",
      ...(sheet.clientId ? { clientId: sheet.clientId } : {}),
      ...(sheet.processId ? { processId: sheet.processId } : {}),
      result: buildPlanilhaResult({ sheet: appliedSheet, sourceSheet: sheet, evaluation }),
    };
  }

  function handleSave() {
    clearStatus();
    const payload = buildSavePayload();
    if (payload) save.mutate(payload);
  }

  function handleDownloadCsv() {
    clearStatus();
    const payload = buildSavePayload();
    if (!payload) return;
    downloadCalculationCsv({ ...payload.result, title: payload.title, calculationType: payload.calculationType });
    showStatus("Planilha baixada em CSV.", "success");
  }

  const visibleProcesses = (processes.data ?? []).filter((process) => !sheet.clientId || process.clientId === sheet.clientId);

  return (
    <section className="workspace planilha-workspace">
      <header className="topbar">
        <div>
          <h1>Planilha de diferenças remuneratórias</h1>
          <p>Preencha as células de entrada como na planilha de referência. As fórmulas ficam ocultas e os resultados são consolidados ao final.</p>
        </div>
        <div className="top-actions">
          <button className="secondary-button" onClick={handleDownloadCsv} type="button"><FileDown size={17} /> Baixar CSV</button>
          {/* <button className="secondary-button" onClick={() => router.push("/calculos/novo")} type="button"><Table2 size={17} /> Assistente</button> */}
          <button className="primary-button" disabled={save.isPending} onClick={handleSave} type="button">
            {save.isPending ? <Loader2 className="spinning" size={17} /> : <Save size={17} />} {save.isPending ? "Salvando..." : "Salvar cálculo"}
          </button>
        </div>
      </header>

      {status && <div className={`module-status ${statusTone}`} role={statusTone === "error" ? "alert" : "status"}>{statusTone === "success" ? <CheckCircle2 size={15} /> : <Info size={15} />} {status}</div>}
      {(ruleError || !incidenceReady) && sheet.incidenceRules.length > 0 && <div className={`module-status${ruleError ? " error" : ""}`} role={ruleError ? "alert" : "status"}>{ruleError?.message ?? "Consultando índices das regras de incidência..."}</div>}
      {saved.isError && <div className="module-status error" role="alert">Não foi possível abrir o cálculo informado.</div>}
      {linksUnavailable && <div className="module-status" role="status">Não foi possível consultar clientes e processos. Verifique se a API está em execução — o cálculo da planilha e o salvamento continuam disponíveis, mas o vínculo fica indisponível.</div>}
      <PlanilhaIssues issues={issues} />

      <div className="planilha-setup">
        <label className="field"><span>Título do cálculo</span><input onChange={(event) => update("title", event.target.value)} placeholder="Diferença salarial — planilha" value={sheet.title} /></label>
        <label className="field"><span>Valor recebido base</span><input inputMode="numeric" onChange={(event) => update("baseReceived", maskPlanilhaCurrency(event.target.value))} placeholder="R$ 0,00" value={formatPlanilhaCurrencyInput(sheet.baseReceived)} /></label>
        <label className="field"><span>Data da citação</span><input inputMode="numeric" maxLength={10} onChange={(event) => update("citationDate", maskPlanilhaDate(event.target.value))} placeholder="DD/MM/AAAA" value={maskPlanilhaDate(sheet.citationDate)} /></label>
        <label className="field"><span>Indexador de referência</span><select onChange={(event) => update("indexSlug", event.target.value)} value={sheet.indexSlug}>
          {PLANILHA_INDEX_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label className="field"><span>Cliente</span><select disabled={linksUnavailable || clients.isLoading} onChange={(event) => { update("clientId", event.target.value); update("processId", ""); }} value={sheet.clientId}>
          <option value="">{linksUnavailable ? "Indisponível" : "Sem vínculo"}</option>
          {(clients.data ?? []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select></label>
        <label className="field"><span>Processo</span><select disabled={linksUnavailable || processes.isLoading || !sheet.clientId} onChange={(event) => update("processId", event.target.value)} value={sheet.processId}>
          <option value="">{linksUnavailable ? "Indisponível" : processes.isLoading ? "Carregando processos..." : "Sem vínculo"}</option>
          {visibleProcesses.map((process) => <option key={process.id} value={process.id}>{process.title}</option>)}
        </select></label>
      </div>

      <section className="planilha-rules" aria-label="Regras de incidência">
        <div className="planilha-rules-heading"><div><span className="planilha-rules-kicker">CONFIGURAÇÃO</span><h2>Regras de incidência</h2><p>Informe o índice e o período. O acumulado é calculado para cada lançamento conforme sua competência.</p></div><span className="planilha-rules-note">A Selic prevalece nos meses em que há taxa Selic publicada.</span></div>
        <div className="planilha-rule-form">
          <label className="field"><span>Índice</span><select value={incidenceDraft.index} onChange={(event) => updateIncidenceDraft("index", event.target.value)}><option value="ipca_e">IPCA-E</option><option value="selic">Selic</option><option value="juros">Juros moratórios (poupança)</option></select></label>
          <label className="field"><span>Início (MM/AAAA)</span><input inputMode="numeric" maxLength={7} value={maskPlanilhaCompetence(incidenceDraft.start)} onChange={(event) => updateIncidenceDraft("start", maskPlanilhaCompetence(event.target.value))} placeholder="07/2021" /></label>
          <label className="field"><span>Fim (MM/AAAA)</span><input inputMode="numeric" maxLength={7} value={maskPlanilhaCompetence(incidenceDraft.end)} onChange={(event) => updateIncidenceDraft("end", maskPlanilhaCompetence(event.target.value))} placeholder="10/2021" /></label>
          <button className="add-rule-button" disabled={incidenceLoading} onClick={addIncidenceRule} type="button"><Plus size={16} /> {incidenceLoading ? "Calculando..." : "Adicionar regra"}</button>
        </div>
        <div className="planilha-rule-list">
          {(sheet.incidenceRules ?? []).map((rule) => {
            const expanded = expandedRules.has(rule.id);
            const detailId = `incidence-detail-${rule.id}`;
            const values = indexValues[incidenceIndexSlug(rule.index)];
            let breakdown = null;
            try {
              if (values) breakdown = calculateIncidenceBreakdown(rule, values, sheet.incidenceRules, indexValues);
            } catch {
              breakdown = null;
            }
            return <article className={`planilha-rule-card${expanded ? " expanded" : ""}`} key={rule.id}>
              <button aria-controls={detailId} aria-expanded={expanded} className="planilha-rule-card-toggle" onClick={() => toggleRuleDetails(rule.id)} type="button">
                <span className="planilha-rule-card-main"><span className={`planilha-rule-badge ${rule.index}`}>{incidenceLabel(rule.index)}</span><strong>{rule.start} <span aria-hidden="true">→</span> {rule.end}</strong></span>
                <span className="planilha-rule-card-result"><span>Acumulado do período</span><strong>{formatRuleSummary(rule, indexValues, sheet.incidenceRules)}</strong></span>
                <span className="planilha-rule-card-chevron" aria-hidden="true">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </button>
              <button aria-label={`Remover regra ${incidenceLabel(rule.index)} de ${rule.start} a ${rule.end}`} className="planilha-rule-card-remove" onClick={() => requestRemoveIncidenceRule(rule)} type="button"><X size={16} /></button>
              {expanded && <div className="planilha-rule-detail" id={detailId}>
                <div className="planilha-rule-detail-heading"><strong>Conferência mensal</strong><span>{rule.start} a {rule.end} · valores consultados no índice cadastrado</span></div>
                {breakdown ? <div className={`planilha-rule-detail-scroll${breakdown.rows.length > 10 ? " scrollable" : ""}`}><table><thead><tr><th>Competência</th><th>Taxa publicada</th><th>Taxa aplicada</th><th>Acumulado restante</th><th>Aplicação</th></tr></thead><tbody>
                  {breakdown.rows.map((row) => <tr key={`${rule.id}-${row.month}`}>
                    <td>{formatMonthNumber(row.month)}</td>
                    <td>{row.sourceRate == null ? "—" : formatRuleRate(row.sourceRate, rule.index)}</td>
                    <td>{row.appliedRate == null ? "—" : formatRuleRate(row.appliedRate, rule.index)}</td>
                    <td>{formatIncidenceAccumulated(row.accumulated, rule.index)}</td>
                    <td>{row.base ? "Mês-base" : row.overridden ? "Selic prevaleceu" : "Incluída"}</td>
                  </tr>)}
                </tbody></table></div> : <div className="planilha-rule-detail-loading">Consultando ou validando os índices deste período…</div>}
              </div>}
            </article>;
          })}
          {(sheet.incidenceRules ?? []).length === 0 && <div className="planilha-rules-empty">Nenhuma regra adicionada. Escolha um índice e um período para calcular as taxas.</div>}
        </div>
      </section>

      <div className="planilha-toolbar">
        <button className="add-rule-button" onClick={() => setRows([...sheet.rows, createPlanilhaRow()])} type="button"><Plus size={16} /> Adicionar linha</button>
        <span className="planilha-toolbar-info">{sheet.rows.length} lançamento(s) · {PLANILHA_RULE_ID}</span>
      </div>

      <SalaryPlanilhaGrid
        evaluation={evaluation}
        onChange={setRows}
        onRowDuplicate={duplicateRow}
        onRowRemove={removeRow}
        sheet={sheet}
        appliedRows={appliedSheet.rows}
      />

      <PlanilhaResults evaluation={evaluation} resultRows={resultRows} summaryRows={summaryRows} />

      {pendingDeleteRule && <div className="confirmation-backdrop" onClick={() => setPendingDeleteRule(null)}>
        <div aria-labelledby="delete-rule-title" aria-modal="true" className="confirmation-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
          <div className="confirmation-dialog-main">
            <div className="confirmation-dialog-content">
            <h2 id="delete-rule-title"><span className="confirmation-dialog-icon"><AlertTriangle size={20} /></span>Excluir regra de incidência?</h2>
            <p>Você está removendo a regra <strong>{incidenceLabel(pendingDeleteRule.index)}</strong>, de <strong>{pendingDeleteRule.start}</strong> a <strong>{pendingDeleteRule.end}</strong>.</p>
            <div className="confirmation-dialog-impact"><strong>Impacto no cálculo</strong><span>As competências desse período serão recalculadas usando apenas as regras restantes. Se não houver outra regra aplicável, a taxa dessa incidência deixará de ser considerada.</span></div>
            </div>
          </div>
          <div className="confirmation-dialog-actions"><button className="back-button" onClick={() => setPendingDeleteRule(null)} type="button">Cancelar</button><button className="danger-button" onClick={removeIncidenceRule} type="button">Excluir regra</button></div>
        </div>
      </div>}
    </section>
  );
}

function readStoredSheet(stored, showStatus) {
  try {
    showStatus("Lançamentos do assistente importados. Os valores devido e recebido passam a ser calculados pelas células da grade.", "success");
    return createPlanilhaSheet(JSON.parse(stored));
  } catch {
    showStatus("Não foi possível ler os lançamentos enviados pelo assistente. A planilha foi aberta em branco.", "error");
    return createPlanilhaSheet();
  }
}

function PlanilhaIssues({ issues }) {
  if (!issues.length) return null;
  return <div className="module-status error planilha-issues" role="alert">
    <AlertTriangle size={15} />
    <ul>
      {issues.slice(0, 6).map((issue) => <li key={`${issue.position}-${issue.message}`}><strong>{issue.position}:</strong> {issue.message}</li>)}
      {issues.length > 6 && <li>e mais {issues.length - 6} apontamento(s).</li>}
    </ul>
  </div>;
}

function PlanilhaResults({ evaluation, resultRows, summaryRows }) {
  const gridTemplate = PLANILHA_RESULT_COLUMNS.map((column) => column.width).join(" ");
  return <div className="planilha-results">
    <div className="card-heading">
      <div><h2>Resultados</h2><p>Consolidação das células calculadas, no mesmo formato da memória de cálculo</p></div>
      <span className="status-pill success"><Check size={13} /> {formatCurrency(toCents(evaluation.payable))}</span>
    </div>

    <div className="result-table-scroll">
      <div className="result-table" role="table" aria-label="Resultados por lançamento" style={{ minWidth: 1080 }}>
        <div className="result-row header" role="row" style={{ gridTemplateColumns: gridTemplate }}>
          {PLANILHA_RESULT_COLUMNS.map((column) => <span key={column.key} role="columnheader">{column.label}</span>)}
        </div>
        {resultRows.map((row) => <div className="result-row" key={row.rowNumber} role="row" style={{ gridTemplateColumns: gridTemplate }}>
          {PLANILHA_RESULT_COLUMNS.map((column) => <span key={column.key} role="cell">{row[column.key]}</span>)}
        </div>)}
        <div className="result-row totals" role="row" style={{ gridTemplateColumns: gridTemplate }}>
          <span role="cell">Σ</span>
          <span role="cell">—</span>
          <span role="cell">Soma dos lançamentos</span>
          {PLANILHA_RESULT_COLUMNS.slice(3).map((column) => <span key={column.key} role="cell">{formatCurrency(toCents(evaluation.columnTotals[column.source]))}</span>)}
        </div>
      </div>
    </div>

    <PlanilhaSummary evaluation={evaluation} summaryRows={summaryRows} />
  </div>;
}

function PlanilhaSummary({ evaluation, summaryRows }) {
  return <section className="salary-result-summary planilha-summary" aria-label="Resumo do período">
    <strong>Resumo do período</strong>
    <div className="salary-result-summary-table">
      {summaryRows.map((row) => <div className={row.total ? "total" : ""} key={row.cell}>
        <b>{row.label}</b><strong>{formatCurrency(toCents(row.value))}</strong>
      </div>)}
       <div><b>SALDO CORRIGIDO DAS DIFERENÇAS</b><strong>{formatCurrency(toCents(evaluation.sheetTotal))}</strong></div>
       <div><b>CONFERÊNCIA</b><strong>{formatCurrency(toCents(evaluation.check))}</strong></div>
    </div>
  </section>;
}

function toCents(value) {
  return Math.round(Number(value ?? 0) * 100);
}

function formatIncidenceAccumulated(value, index) {
  return index === "ipca_e"
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 })
    : `${value.toLocaleString("pt-BR", { minimumFractionDigits: index === "selic" ? 2 : 4, maximumFractionDigits: 6 })}%`;
}

function formatRuleSummary(rule, indexValues, rules) {
  const values = indexValues[incidenceIndexSlug(rule.index)];
  if (!values) return "consultando índices...";
  try {
    return formatIncidenceAccumulated(calculateIncidenceBreakdown(rule, values, rules, indexValues).accumulated, rule.index);
  } catch {
    return "índices indisponíveis";
  }
}

function formatMonthNumber(month) {
  return `${String(month % 12 + 1).padStart(2, "0")}/${Math.floor(month / 12)}`;
}

function formatRuleRate(value, index) {
  const digits = index === "selic" ? 2 : 4;
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function incidenceLabel(index) {
  if (index === "ipca_e") return "IPCA-E";
  if (index === "juros") return "POUPANÇA";
  return "SELIC";
}
