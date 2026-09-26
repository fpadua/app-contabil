"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, FileDown, Info, Loader2, Plus, Save, Table2, Wand2 } from "lucide-react";
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
  evaluatePlanilhaSheet,
  formatPlanilhaCurrencyInput,
  maskPlanilhaCurrency,
  maskPlanilhaDate,
} from "../lib/planilha";

export function SalaryPlanilha() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calculationId = searchParams.get("calculo");
  const [sheet, setSheet] = useState(createPlanilhaSheet);
  const [status, setStatus] = useState(null);
  const [issues, setIssues] = useState([]);

  const clients = useQuery({ queryKey: ["client-options"], queryFn: () => api.get("/api/clients/options") });
  const processes = useQuery({ queryKey: ["process-options"], queryFn: () => api.get("/api/processes/options") });
  const saved = useQuery({ queryKey: ["calculation", calculationId], queryFn: () => api.get(`/api/calculations/${calculationId}`), enabled: Boolean(calculationId) });
  const linksUnavailable = clients.isError || processes.isError;

  const evaluation = useMemo(() => evaluatePlanilhaSheet(sheet), [sheet]);
  const summaryRows = useMemo(() => buildPlanilhaSummaryRows(evaluation), [evaluation]);
  const resultRows = useMemo(() => buildPlanilhaResultRows({ sheet, evaluation }), [sheet, evaluation]);

  const update = (field, value) => setSheet((current) => ({ ...current, [field]: value }));
  const setRows = (rows) => setSheet((current) => ({ ...current, rows }));
  const addRow = (index) => setRows([...sheet.rows.slice(0, index + 1), createPlanilhaRow({ kind: sheet.rows[index]?.kind }), ...sheet.rows.slice(index + 1)]);
  const duplicateRow = (index) => setRows([...sheet.rows.slice(0, index + 1), { ...sheet.rows[index], id: createPlanilhaRow().id }, ...sheet.rows.slice(index + 1)]);
  const removeRow = (index) => setRows(sheet.rows.filter((_, current) => current !== index));

  const save = useMutation({
    mutationFn: (payload) => api.post("/api/calculations", payload),
    onSuccess: (data) => router.push(`/calculos/${data.id}`),
    onError: (error) => setStatus(error.message),
  });

  useEffect(() => {
    const stored = window.sessionStorage.getItem(PLANILHA_STORAGE_KEY);
    if (!stored) return;
    window.sessionStorage.removeItem(PLANILHA_STORAGE_KEY);
    setSheet(readStoredSheet(stored, setStatus));
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

  function applyIndexesToAll() {
    const [first] = sheet.rows;
    if (!first) return;
    setRows(sheet.rows.map((row) => ({
      ...row,
      correction: row.correction || first.correction,
      interest: row.interest || first.interest,
      selic: row.selic || first.selic,
    })));
    setStatus("Índice de atualização, juros e Selic da primeira linha aplicados às linhas ainda vazias.");
  }

  function buildSavePayload() {
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
      result: buildPlanilhaResult({ sheet, evaluation }),
    };
  }

  function handleSave() {
    const payload = buildSavePayload();
    if (payload) save.mutate(payload);
  }

  function handleDownloadCsv() {
    const payload = buildSavePayload();
    if (!payload) return;
    downloadCalculationCsv({ ...payload.result, title: payload.title, calculationType: payload.calculationType });
    setStatus("Planilha baixada em CSV.");
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
          <button className="secondary-button" onClick={() => router.push("/calculos/novo")} type="button"><Table2 size={17} /> Assistente</button>
          <button className="primary-button" disabled={save.isPending} onClick={handleSave} type="button">
            {save.isPending ? <Loader2 className="spinning" size={17} /> : <Save size={17} />} {save.isPending ? "Salvando..." : "Salvar cálculo"}
          </button>
        </div>
      </header>

      {status && <div className="module-status" role="status"><Info size={15} /> {status}</div>}
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

      <div className="planilha-toolbar">
        <button className="add-rule-button" onClick={() => setRows([...sheet.rows, createPlanilhaRow()])} type="button"><Plus size={16} /> Adicionar linha</button>
        <button className="add-rule-button" onClick={applyIndexesToAll} type="button"><Wand2 size={16} /> Aplicar índices da 1ª linha</button>
        <span className="planilha-toolbar-info">{sheet.rows.length} lançamento(s) · {PLANILHA_RULE_ID}</span>
      </div>

      <SalaryPlanilhaGrid
        evaluation={evaluation}
        onChange={setRows}
        onRowAdd={addRow}
        onRowDuplicate={duplicateRow}
        onRowRemove={removeRow}
        sheet={sheet}
      />

      <PlanilhaResults evaluation={evaluation} resultRows={resultRows} summaryRows={summaryRows} />
    </section>
  );
}

function readStoredSheet(stored, setStatus) {
  try {
    setStatus("Lançamentos do assistente importados. Os valores devido e recebido passam a ser calculados pelas células da grade.");
    return createPlanilhaSheet(JSON.parse(stored));
  } catch {
    setStatus("Não foi possível ler os lançamentos enviados pelo assistente. A planilha foi aberta em branco.");
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
  return <section className="salary-result-summary" aria-label="Resumo do período">
    <strong>Resumo do período</strong>
    <div className="salary-result-summary-table">
      {summaryRows.map((row) => <div className={row.total ? "total" : ""} key={row.cell}>
        <span>{row.cell}</span><b>{row.label}</b><strong>{formatCurrency(toCents(row.value))}</strong>
      </div>)}
      <div><span>I30</span><b>SALDO CORRIGIDO DAS DIFERENÇAS (soma da coluna M)</b><strong>{formatCurrency(toCents(evaluation.sheetTotal))}</strong></div>
      <div><span>N38</span><b>CONFERÊNCIA (I38 − I30)</b><strong>{formatCurrency(toCents(evaluation.check))}</strong></div>
    </div>
  </section>;
}

function toCents(value) {
  return Math.round(Number(value ?? 0) * 100);
}
