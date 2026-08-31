"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Calculator, Loader2, Pencil, User, X } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { api, formatDate, formatRequired } from "../../../lib/api";
import { indexLabel } from "../../../lib/calculation-export";

export default function ProcessDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState("");
  const record = useQuery({ queryKey: ["process", id], queryFn: () => api.get(`/api/processes/${id}`), enabled: Boolean(id) });
  const clients = useQuery({ queryKey: ["client-options"], queryFn: () => api.get("/api/clients/options") });
  const calculations = useQuery({ queryKey: ["calculations-by-process", id], queryFn: () => api.get(`/api/calculations?processId=${id}`), enabled: Boolean(id) });

  const process = record.data;
  const linkedCalculations = calculations.data ?? [];

  const update = useMutation({
    mutationFn: (data) => api.put(`/api/processes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process", id] });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      setEditing(false);
      setFormError("");
    },
    onError: (error) => setFormError(error.message),
  });

  function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const data = new FormData(event.currentTarget);
    update.mutate({
      clientId: data.get("client") || null,
      title: data.get("title"),
      number: data.get("number"),
      calculationType: data.get("type"),
      status: data.get("status"),
      court: data.get("court"),
      division: data.get("division"),
      notes: data.get("notes"),
    });
  }

  return (
    <AppShell>
      <section className="workspace module-workspace">
        <Link className="record-back" href="/processos"><ArrowLeft size={16} /> Voltar para processos</Link>

        {loadMessage(record, clients, calculations) && <div className="module-status" role="status">{loadMessage(record, clients, calculations)}</div>}

        {process && <>
          <header className="module-header">
            <div><span className="module-eyebrow">{process.calculationType}</span><h1>{process.title || process.number}</h1><p>Registrado em {formatDate(process.createdAt)}</p></div>
            <div className="top-actions module-actions">
              <button className="secondary-button" type="button" onClick={editing ? () => setEditing(false) : () => setEditing(true)}>{editing ? <X size={16} /> : <Pencil size={16} />} {editing ? "Cancelar edição" : "Editar processo"}</button>
              <span className={`status-pill ${statusTone(process.status)}`}>{process.status}</span>
            </div>
          </header>

          <div className="stat-grid">
            <Stat label="Cliente vinculado" value={process.client?.name ?? "Sem vínculo"} hint={process.client ? <Link className="text-link" href={`/clientes/${process.client.id}`}>Ver cadastro</Link> : "Anexe um cliente" } />
            <Stat label="Cálculos vinculados" value={String(linkedCalculations.length)} hint="Memórias registradas" />
            <Stat label="Número" value={formatRequired(process.number)} hint={process.court ? `${process.court}${process.division ? ` · ${process.division}` : ""}` : "Sem origem" } />
          </div>

          <div className="detail-grid">
            <aside className="data-card index-summary">
              <div className="card-heading"><div><h2>Dados do processo</h2><p>{editing ? "Edite e salve as alterações" : "Informações registradas"}</p></div></div>
              <div className="index-line"><span>Cliente</span><strong>{process.client ? <Link className="text-link" href={`/clientes/${process.client.id}`}><User size={13} /> {process.client.name}</Link> : "Sem vínculo"}</strong></div>
              <div className="index-line"><span>Título</span><strong>{process.title || "—"}</strong></div>
              <div className="index-line"><span>Número</span><strong>{formatRequired(process.number)}</strong></div>
              <div className="index-line"><span>Tipo de cálculo</span><strong>{process.calculationType}</strong></div>
              <div className="index-line"><span>Origem</span><strong>{process.court ? `${process.court}${process.division ? ` · ${process.division}` : ""}` : "—"}</strong></div>
              <div className="index-line"><span>Situação</span><strong>{process.status}</strong></div>
              {process.notes && <div className="index-line"><span>Observações</span><strong>{process.notes}</strong></div>}

              {editing && <form className="link-editor" onSubmit={handleSubmit}>
                <div className="fields-grid compact">
                  <label className="field field-wide"><span>Título do processo *</span><input defaultValue={process.title} name="title" required /></label>
                  <label className="field"><span>Número do processo ou contrato</span><input defaultValue={process.number ?? ""} name="number" /></label>
                  <label className="field"><span>Cliente</span><select defaultValue={process.clientId ?? ""} name="client"><option value="">Sem vínculo</option>{(clients.data ?? []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
                  <label className="field"><span>Tipo de cálculo</span><select defaultValue={process.calculationType} name="type"><option>Correção monetária</option><option>Cálculo judicial</option><option>Financiamento SAC</option><option>Financiamento PRICE</option><option>Diferença salarial</option><option>Outro</option></select></label>
                  <label className="field"><span>Situação</span><select defaultValue={process.status} name="status"><option>Em andamento</option><option>Em revisão</option><option>Concluído</option></select></label>
                  <label className="field"><span>Tribunal ou órgão</span><input defaultValue={process.court ?? ""} name="court" placeholder="Ex.: TJGO" /></label>
                  <label className="field"><span>Vara ou unidade</span><input defaultValue={process.division ?? ""} name="division" /></label>
                  <label className="field field-wide"><span>Observações</span><textarea defaultValue={process.notes ?? ""} name="notes" rows="3" /></label>
                </div>
                {formError && <p className="field-error" role="alert">{formError}</p>}
                <div className="link-editor-actions"><button className="back-button" type="button" onClick={() => setEditing(false)}>Cancelar</button><button className="primary-button" disabled={update.isPending} type="submit">{update.isPending ? <Loader2 className="spinning" size={17} /> : <Pencil size={16} />} Salvar alterações</button></div>
              </form>}
            </aside>

            <article className="data-card">
              <div className="card-heading"><div><h2>Cálculos vinculados</h2><p>Memórias de cálculo deste processo</p></div></div>
              <div className="link-list">
                {linkedCalculations.length === 0 && <p className="empty-state"><Calculator size={26} /><strong>Nenhum cálculo vinculado</strong><span>Crie um cálculo e vincule este processo no assistente.</span></p>}
                {linkedCalculations.map((calculation) => (
                  <Link className="index-line link-line" href={`/calculos/${calculation.id}`} key={calculation.id}>
                    <span><strong>{calculation.title}</strong><small>{calculation.calculationType} · {calculation.indexSlug ? indexLabel(calculation.indexSlug) : "Sem correção"} · {formatDate(calculation.startDate)} a {formatDate(calculation.endDate)}</small></span>
                    <span>{statusPill(calculation.status ?? "Concluído")}</span>
                  </Link>
                ))}
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

function statusPill(value) {
  return <span className={`status-pill ${statusTone(value)}`}>{value}</span>;
}

function statusTone(value) {
  const normalized = String(value).toLocaleLowerCase("pt-BR");
  if (normalized === "ativo" || normalized === "concluído") return "success";
  if (normalized === "inativo" || normalized === "rascunho" || normalized === "andamento" || normalized === "revisão") return "warning";
  return "neutral";
}

function loadMessage(record, clients, calculations) {
  if (record.isLoading || clients.isLoading || calculations.isLoading) return "Carregando dados do processo...";
  if (record.isError || clients.isError || calculations.isError) return "Não foi possível carregar os dados. Verifique se a API está em execução.";
  return null;
}