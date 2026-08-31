"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Loader2, RefreshCw, Search, UploadCloud, X } from "lucide-react";
import { AppShell } from "../../components/app-shell";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const MAX_PDF_BYTES = 10 * 1024 * 1024;

const columns = [
  { key: "index", label: "Índice", width: "1.2fr" }, { key: "reference", label: "Competência" },
  { key: "monthly", label: "Variação mensal" }, { key: "accumulated", label: "Acumulado" },
  { key: "source", label: "Fonte" }, { key: "origin", label: "Origem" }, { key: "status", label: "Situação" },
  { key: "actions", label: "", width: "max-content" },
];

export default function IndicesPage() {
  const queryClient = useQueryClient();
  const indices = useQuery({ queryKey: ["economic-indices"], queryFn: fetchIndices });
  const sync = useMutation({ mutationFn: synchronizeIndices, onSuccess: (data) => data?.taskId && trackTask(data.taskId, "index-sync") });
  const importIndex = useMutation({ mutationFn: importStart, onSuccess: (data) => data?.taskId && trackTask(data.taskId, "index-import") });
  const refreshIndex = useMutation({ mutationFn: refreshStart, onSuccess: (data) => data?.taskId && trackTask(data.taskId, "index-refresh") });

  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [prefillSlug, setPrefillSlug] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [query, setQuery] = useState("");
  const [task, setTask] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!task || task.finished) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const current = await fetchTask(task.taskId);
        if (cancelled) return;
        const next = { ...task, progress: current.progress, message: current.message, status: current.status, result: current.result, error: current.error, current: current.current, total: current.total, currentName: current.currentName };
        if (current.status === "SUCCEEDED" || current.status === "FAILED") {
          next.finished = true;
          queryClient.invalidateQueries({ queryKey: ["economic-indices"] });
          setTask(next);
        } else {
          setTask(next);
        }
      } catch {
        // falha transitória de rede; segue tentando
      }
    };
    tick();
    const id = setInterval(tick, 1200);
    return () => { cancelled = true; clearInterval(id); };
  }, [task?.taskId, task?.status, task?.finished]);

  function trackTask(taskId, type) {
    setTask({ taskId, type, status: "RUNNING", progress: 0, message: "Iniciando...", finished: false });
  }

  const rows = indices.isLoading ? null : indices.data?.length ? indices.data.map(mapIndex) : [];

  const pendingCount = indices.data ? indices.data.filter((item) => !item.values?.[0]?.published).length : null;

  const statusMessage = task?.finished
    ? task.status === "FAILED" ? (task.error ?? "A tarefa falhou.") : taskSummary(task)
    : importIndex.isError ? importIndex.error.message
    : refreshIndex.isError ? refreshIndex.error.message
    : sync.isError ? sync.error.message
    : indices.isError ? indices.error.message
    : null;

  const taskBusy = Boolean(task && !task.finished);
  const statusError = taskBusy ? false : task?.finished ? task.status === "FAILED" : (importIndex.isError || refreshIndex.isError || sync.isError);

  function chooseFile(selectedFile) {
    setFileError("");
    if (!selectedFile) return;
    if (!/^application\/pdf$|\.pdf$/i.test(selectedFile.type) && !/\.pdf$/i.test(selectedFile.name)) {
      setFileError("Envie um arquivo PDF seguindo o modelo do selic.pdf.");
      setFile(null);
      return;
    }
    if (selectedFile.size > MAX_PDF_BYTES) {
      setFileError("O arquivo deve ter no máximo 10 MB.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
  }

  function handleImport(event) {
    event.preventDefault();
    setFileError("");
    if (!file) {
      setFileError("Selecione um arquivo PDF para importar.");
      inputRef.current?.focus?.();
      return;
    }
    const data = new FormData(event.currentTarget);
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("name", data.get("name") || "");
    form.append("source", data.get("source") || "");
    if (prefillSlug) form.append("slug", prefillSlug);
    importIndex.mutate(form);
  }

  function openImportAsNew() {
    setPrefillSlug(null);
    setActiveMenu(null);
    setImportOpen((open) => !open);
  }

  function handleRefreshSite(row) {
    setActiveMenu(null);
    refreshIndex.mutate(row.slug);
  }

  function handleRefreshPdf(row) {
    setActiveMenu(null);
    setPrefillSlug(row.slug);
    setImportOpen(true);
  }

  return (
    <AppShell>
      <section className="workspace module-workspace">
        <header className="module-header module-actions">
          <div><span className="module-eyebrow">BASE ECONÔMICA</span><h1>Índices econômicos</h1><p>Consulte competências, fontes e o estado das séries utilizadas nos cálculos.</p></div>
          <div className="top-actions">
            <button className="secondary-button" disabled={taskBusy} onClick={openImportAsNew} type="button"><UploadCloud size={16} /> Importar PDF</button>
            <button className="primary-button module-action" disabled={sync.isPending || taskBusy} onClick={() => sync.mutate()} type="button"><RefreshCw className={sync.isPending ? "spinning" : ""} size={17} /> {sync.isPending ? "Atualizando..." : "Atualizar índices"}</button>
          </div>
        </header>

        {task && !task.finished && (
          <div className="task-progress" role="status">
            <div className="task-progress-head"><strong>{taskProgressTitle(task)}</strong><span>{task.total ? `${task.current} de ${task.total} índices · ` : ""}{task.progress}%</span></div>
            <div className="progress-track" aria-hidden="true"><div className="progress-bar" style={{ width: `${task.progress}%` }} /></div>
            <p><Loader2 className="spinning" size={14} /> {task.message}</p>
            <small>Você pode continuar usando o sistema enquanto isso acontece.</small>
          </div>
        )}

        {importOpen && (
          <form className="import-panel" onSubmit={handleImport}>
            <div className="import-panel-head"><strong>{prefillSlug ? `Reimportar PDF para "${prefillSlug}"` : "Importar índice a partir de PDF"}</strong><span>As colunas são anos e as linhas, meses — conforme o selic.pdf.</span><button aria-label="Fechar" onClick={() => setImportOpen(false)} type="button"><X size={17} /></button></div>
            <input accept=".pdf,application/pdf" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} ref={inputRef} type="file" />
            <div className="import-panel-fields">
              {!file ? (
                <button className="upload-zone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files?.[0]); }} type="button">
                  <UploadCloud size={30} /><strong>Arraste o PDF ou clique para selecionar</strong><span>Arquivo de até 10 MB, no formato do selic.pdf</span>
                </button>
              ) : (
                <div className="selected-file"><div><FileText size={22} /><span><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></span></div><button aria-label="Remover arquivo" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} type="button"><X size={17} /></button></div>
              )}
              <div className="fields-grid compact">
                <label className="field"><span>Nome do índice</span><input name="name" placeholder="Ex.: Selic" /></label>
                <label className="field"><span>Fonte</span><input name="source" placeholder="Ex.: Bacen" /></label>
              </div>
            </div>
            {fileError && <p className="field-error" role="alert">{fileError}</p>}
            {importIndex.isError && <p className="field-error" role="alert">{importIndex.error.message}</p>}
            <div className="import-actions">
              <button className="back-button" onClick={() => setImportOpen(false)} type="button">Cancelar</button>
              <button className="primary-button" disabled={importIndex.isPending || taskBusy} type="submit">{importIndex.isPending ? <><RefreshCw className="spinning" size={16} /> Importando...</> : (prefillSlug ? "Reimportar índice" : "Importar índice")}</button>
            </div>
          </form>
        )}

        {statusMessage && <div className={`module-status ${statusError ? "error" : ""}`} role="status">{statusMessage}</div>}

        <div className="stat-grid">
          <article className="stat-card"><span>Índices ativos</span><strong>{indices.data ? String(indices.data.length) : "—"}</strong><small>Séries monitoradas</small></article>
          <article className="stat-card"><span>Última verificação</span><strong>{indices.data ? "Agora" : "—"}</strong><small>Sincronização auditável</small></article>
          <article className="stat-card"><span>Pendências</span><strong>{pendingCount === null ? "0" : String(pendingCount)}</strong><small>Competências não publicadas</small></article>
        </div>

        <div className="data-card">
          <div className="data-toolbar">
            <div className="search-field"><Search size={17} /><input aria-label="Buscar em Índices econômicos" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." value={query} /></div>
            <span>{rows ? `${rows.length} registro${rows.length === 1 ? "" : "s"}` : "Carregando..."}</span>
          </div>
          <div className="table-scroll">
            <div className="data-table" role="table" style={{ "--columns": columns.map((column) => column.width ?? "1fr").join(" ") }}>
              <div className="data-row data-head" role="row">{columns.map((column) => <span key={column.key}>{column.label}</span>)}</div>
              {(rows ?? []).map((row, rowIndex) => (
                <div className="data-row" key={row.id} role="row">
                  {columns.map((column) => {
                    if (column.key === "index") return <span key={column.key}><Link className="index-name-link" href={`/indices/${row.slug}`}>{row.index}</Link></span>;
                    if (column.key === "actions") return <span className="row-actions" key={column.key}>{rowActions(row, rowIndex >= rows.length - 2)}</span>;
                    return <span className={column.key === "status" || column.key === "origin" ? `status-pill ${pillClass(row[column.key], column.key)}` : ""} key={column.key}>{row[column.key]}</span>;
                  })}
                </div>
              ))}
            </div>
          </div>
          {rows && rows.length === 0 && <div className="empty-state"><Search size={28} /><strong>Nenhum registro encontrado</strong><span>Nenhum índice econômico disponível ainda.</span></div>}
          {!rows && <div className="empty-state"><Loader2 className="spinning" size={28} /><strong>Carregando índices...</strong><span>Consultando o banco de dados.</span></div>}
        </div>
      </section>
    </AppShell>
  );

  function rowActions(row, opensUpward) {
    return (
      <div className="row-menu">
        <button
          aria-haspopup="menu"
          aria-expanded={activeMenu === row.id}
          className="row-update"
          disabled={taskBusy}
          onClick={() => setActiveMenu((current) => current === row.id ? null : row.id)}
          type="button"
        >
          <RefreshCw size={14} /> Atualizar <ChevronDown size={14} />
        </button>
        {activeMenu === row.id && (
          <div className={`row-menu-pop${opensUpward ? " opens-upward" : ""}`} role="menu">
            <button onClick={() => handleRefreshSite(row)} role="menuitem" type="button"><RefreshCw size={15} /><span><strong>Atualizar via site</strong><small>Releitura da fonte pública (Playwright)</small></span></button>
            <button onClick={() => handleRefreshPdf(row)} role="menuitem" type="button"><FileText size={15} /><span><strong>Reimportar PDF</strong><small>Substituir pela versão de um PDF</small></span></button>
          </div>
        )}
      </div>
    );
  }
}

async function fetchIndices() {
  const response = await fetch(`${apiUrl}/api/indices`);
  if (!response.ok) throw new Error("Não foi possível consultar os índices.");
  return response.json();
}

async function synchronizeIndices() {
  const response = await fetch(`${apiUrl}/api/indices/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? payload.errors?.join(" | ") ?? "Não foi possível sincronizar os índices.");
  return payload;
}

async function refreshStart(slug) {
  const response = await fetch(`${apiUrl}/api/indices/${slug}/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? payload?.errors?.join(" | ") ?? "Não foi possível iniciar a atualização do índice.");
  return payload;
}

async function importStart(formData) {
  const response = await fetch(`${apiUrl}/api/indices/import`, { method: "POST", body: formData });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? payload?.errors?.join(" | ") ?? "Não foi possível importar o índice.");
  return payload;
}

async function fetchTask(taskId) {
  const response = await fetch(`${apiUrl}/api/tasks/${taskId}`);
  if (!response.ok) throw new Error("Não foi possível consultar o progresso da tarefa.");
  return response.json();
}

function taskProgressTitle(task) {
  if (task.type === "index-sync") return "Atualizando todos os índices via site";
  if (task.type === "index-refresh") return "Atualizando índice via site (Playwright)";
  return "Importando índice via PDF";
}

function taskSummary(task) {
  const result = task.result;
  if (!result) return "Tarefa concluída.";
  if (task.type === "index-sync") {
    return `Sincronização concluída: ${result.inserted} inclusões e ${result.updated} atualizações${result.failed ? ` e ${result.failed} falhas` : ""}.`;
  }
  const name = result.index?.name ?? (task.type === "index-import" ? "índice importado" : "índice");
  const kind = task.type === "index-refresh" ? "Atualização via site" : "Importação";
  return `${kind} concluída para ${name}: ${result.inserted} inclusões e ${result.updated} atualizações.`;
}

function mapIndex(item) {
  const latest = item.values?.[0];
  return {
    id: item.id,
    slug: item.slug,
    index: item.name,
    reference: latest ? formatPeriod(latest.referenceDate) : "Sem dados",
    monthly: formatDecimal(latest?.monthlyValue, "%"),
    accumulated: formatDecimal(latest?.accumulatedValue, "%"),
    source: item.source,
    origin: item.origin === "IMPORTED" ? "Importado" : "Site",
    status: latest?.published ? "Atualizado" : "Pendente",
  };
}

function formatPeriod(value) {
  const [year, month] = String(value).slice(0, 7).split("-");
  return `${month}/${year}`;
}

function formatDecimal(value, suffix = "") {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${suffix}`;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function pillClass(value, key) {
  const normalized = String(value).toLocaleLowerCase("pt-BR");
  if (key === "origin") return normalized === "importado" ? "success" : "neutral";
  if (normalized.includes("conclu") || normalized.includes("atualizado") || normalized.includes("validado") || normalized.includes("ativo")) return "success";
  if (normalized.includes("pendente") || normalized.includes("andamento") || normalized.includes("revisão")) return "warning";
  return "neutral";
}
