"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, FileDown, Link2, Loader2, Pencil, Table2, X } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { CalculationMemoryTable } from "../../../components/calculation-memory-table";
import { CalculationAmortizationTable } from "../../../components/calculation-amortization-table";
import { api, formatCurrency, formatDate, formatFactor } from "../../../lib/api";
import { indexLabel, downloadCalculationCsv, downloadCalculationPdf } from "../../../lib/calculation-export";

export default function CalculationDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["calculation", id], queryFn: () => api.get(`/api/calculations/${id}`), enabled: Boolean(id) });
  const clients = useQuery({ queryKey: ["client-options"], queryFn: () => api.get("/api/clients/options"), enabled: true });
  const processes = useQuery({ queryKey: ["process-options"], queryFn: () => api.get("/api/processes/options"), enabled: true });
  const calculation = query.data;
  const months = calculation?.months ?? [];
  const installments = calculation?.installments ?? [];
  const isSchedule = installments.length > 0;
  const isDraft = calculation?.status === "Rascunho";
  const [exportBusy, setExportBusy] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ clientId: calculation?.clientId ?? "", processId: calculation?.processId ?? "" });
  const [linkMessage, setLinkMessage] = useState(null);
  const [linkError, setLinkError] = useState(null);

  const updateLink = useMutation({
    mutationFn: (data) => api.put(`/api/calculations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculation", id] });
      queryClient.invalidateQueries({ queryKey: ["calculations"] });
      queryClient.invalidateQueries({ queryKey: ["calculations-by-client"] });
      queryClient.invalidateQueries({ queryKey: ["calculations-by-process"] });
      setLinkOpen(false);
      setLinkMessage("Vínculo atualizado.");
      setLinkError(null);
    },
    onError: (error) => setLinkError(error.message),
  });

  function openLinkEditor() {
    setLinkForm({ clientId: calculation?.clientId ?? "", processId: calculation?.processId ?? "" });
    setLinkError(null);
    setLinkOpen(true);
  }

  function submitLink(event) {
    event.preventDefault();
    setLinkError(null);
    updateLink.mutate({ clientId: linkForm.clientId || null, processId: linkForm.processId || null });
  }

  const visibleProcesses = (processes.data ?? []).filter((process) => !linkForm.clientId || process.clientId === linkForm.clientId);

  function handleDownloadCsv() {
    setExportBusy("csv");
    setExportError(null);
    downloadCalculationCsv(calculation);
    setExportBusy(null);
  }

  async function handleDownloadPdf() {
    setExportBusy("pdf");
    setExportError(null);
    try {
      await downloadCalculationPdf(calculation);
    } catch (error) {
      setExportError(error.message);
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <AppShell>
      <section className="workspace module-workspace">
        <Link className="record-back" href="/calculos"><ArrowLeft size={16} /> Voltar para cálculos</Link>

        {loadMessage(query) && <div className="module-status" role="status">{loadMessage(query)}</div>}
        {exportError && <div className="module-status error" role="alert">Não foi possível exportar: {exportError}</div>}
        {isDraft && <div className="module-status" role="status">Rascunho salvo sem resultado. Conclua o cálculo para gerar memória e exportações.</div>}

        {calculation && <>
          <header className="module-header">
            <div><span className="module-eyebrow">{calculation.calculationType}</span><h1>{calculation.title}</h1><p>{periodText(calculation)}</p></div>
            <div className="top-actions module-actions">
              {!isDraft && <>
                <button className="secondary-button" type="button" disabled={exportBusy !== null} onClick={handleDownloadCsv}><Table2 size={16} /> Planilha</button>
                <button className="secondary-button" type="button" disabled={exportBusy !== null} onClick={handleDownloadPdf}>{exportBusy === "pdf" ? <Loader2 className="spinning" size={16} /> : <FileDown size={16} />} PDF</button>
              </>}
              <button className="secondary-button" type="button" onClick={openLinkEditor}><Link2 size={16} /> Editar vínculo</button>
              <span className={`status-pill ${isDraft ? "warning" : "success"}`}>{calculation.status}</span>
            </div>
          </header>

          <div className="stat-grid">
            <Stat label="Valor original" value={formatCurrency(calculation.principalInCents)} hint="Principal informado" />
            <Stat label="Valor corrigido" value={isDraft ? "—" : formatCurrency(calculation.correctedInCents)} hint={isDraft ? "Rascunho sem resultado" : `Correção de ${formatCurrency(calculation.correctionInCents)}`} />
            <Stat label="Fator acumulado" value={isDraft ? "—" : formatFactor(calculation.accumulatedFactor)} hint={isDraft ? "—" : calculation.traceabilityRuleId} />
          </div>

          <div className="detail-grid">
            <aside className="data-card index-summary">
              <div className="card-heading"><div><h2>Parâmetros do cálculo</h2><p>Fonte e versão registradas na memória</p></div></div>
              <div className="index-line"><span>Indexador</span><strong>{isDraft ? "—" : (calculation.indexSlug ? indexLabel(calculation.indexSlug) : "Sem correção")}</strong></div>
              <div className="index-line"><span>Período</span><strong>{formatDate(calculation.startDate)} a {formatDate(calculation.endDate)}</strong></div>
              <div className="index-line"><span>{isSchedule ? "Parcelas" : "Competências"}</span><strong>{isDraft ? "—" : (isSchedule ? installments.length : months.length)}</strong></div>
              {reflectionText(calculation) && <div className="index-line"><span>Reflexos</span><strong>{reflectionText(calculation)}</strong></div>}
              <div className="index-line"><span>Cliente</span><strong>{calculation.client?.name ?? "—"}</strong></div>
              <div className="index-line"><span>Processo</span><strong>{calculation.process ? `${calculation.process.title}${calculation.process.number ? ` (${calculation.process.number})` : ""}` : "—"}</strong></div>
              <div className="index-line"><span>Regra aplicada</span><strong>{isDraft ? "—" : calculation.traceabilityRuleId}</strong></div>
              <div className="index-line"><span>Criado em</span><strong>{formatDate(calculation.createdAt)}</strong></div>

              {linkMessage && <div className="module-status" role="status">{linkMessage}</div>}
              {linkOpen && <form className="link-editor" onSubmit={submitLink}>
                <div className="link-editor-title"><Link2 size={16} /> Editar vínculo de cliente e processo</div>
                <div className="fields-grid compact">
                  <label className="field"><span>Cliente</span><select value={linkForm.clientId} onChange={(event) => { setLinkForm((current) => ({ ...current, clientId: event.target.value, processId: "" })); setLinkError(null); }}>
                    <option value="">Sem vínculo</option>{(clients.data ?? []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
                  <label className="field"><span>Processo</span><select value={linkForm.processId} onChange={(event) => setLinkForm((current) => ({ ...current, processId: event.target.value }))}>
                    <option value="">Sem vínculo</option>{visibleProcesses.map((process) => <option key={process.id} value={process.id}>{process.title}{process.number ? ` (${process.number})` : ""}</option>)}</select></label>
                </div>
                {!linkForm.clientId && visibleProcesses.length > 0 && <p className="section-description">Processos de todos os clientes estão listados.</p>}
                {linkError && <p className="field-error" role="alert">{linkError}</p>}
                <div className="link-editor-actions"><button className="back-button" type="button" onClick={() => setLinkOpen(false)}>Cancelar</button><button className="primary-button" disabled={updateLink.isPending} type="submit">{updateLink.isPending ? <Loader2 className="spinning" size={17} /> : <Link2 size={16} />} Salvar vínculo</button></div>
              </form>}
            </aside>

            <article className="data-card">
              <div className="card-heading"><div><h2>Memória de cálculo</h2><p>{isDraft ? "O resultado será gerado ao concluir o cálculo" : (isSchedule ? "Cada parcela com amortização, juros e saldo devedor" : "Cada competência com seu fator acumulado e valor")}</p></div></div>
              <div className="memory-body">
                {isDraft
                  ? <p className="empty-state"><strong>Rascunho sem memória</strong><span>Conclua o cálculo pelo assistente para registrar a memória.</span></p>
                  : isSchedule
                    ? <CalculationAmortizationTable data={calculation} ariaLabel={`Memória de amortização de ${calculation.title}`} />
                    : months.length > 0
                      ? <CalculationMemoryTable data={calculation} indexLabel={calculation.indexSlug ? indexLabel(calculation.indexSlug) : "Sem correção"} ariaLabel={`Memória de cálculo de ${calculation.title}`} />
                      : <p className="empty-state"><strong>Memória não registrada</strong><span>Este cálculo foi salvo com fator informado diretamente.</span></p>}
              </div>
            </article>
          </div>
        </>}
      </section>
    </AppShell>
  );
}

function Stat({ label, value, hint }) {
  return <article className="stat-card"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

function periodText(calculation) {
  const schedule = (calculation.installments ?? []).length > 0;
  return `${formatDate(calculation.startDate)} a ${formatDate(calculation.endDate)} — ${schedule ? "amortização" : "atualização monetária"}`;
}

function reflectionText(calculation) {
  const reflections = calculation.params?.reflections;
  if (!reflections) return "";
  const items = [];
  if (reflections.decimoTerceiro) items.push("13º salário");
  if (reflections.vacationsWithBonus) items.push("férias + 1/3");
  return items.join(" + ");
}

function loadMessage(query) {
  if (query.isLoading) return "Carregando cálculo...";
  if (query.isError) return "Não foi possível carregar este cálculo. O registro pode ter sido removido.";
  return null;
}