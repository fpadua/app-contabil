"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Calculator, FileText, Loader2, Pencil, X } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { api, formatDate, formatRequired } from "../../../lib/api";
import { indexLabel } from "../../../lib/calculation-export";

export default function ClientDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [personType, setPersonType] = useState("Pessoa física");
  const [formError, setFormError] = useState("");
  const client = useQuery({ queryKey: ["client", id], queryFn: () => api.get(`/api/clients/${id}`), enabled: Boolean(id) });
  const processes = useQuery({ queryKey: ["processes"], queryFn: () => api.get("/api/processes") });
  const calculations = useQuery({ queryKey: ["calculations-by-client", id], queryFn: () => api.get(`/api/calculations?clientId=${id}`), enabled: Boolean(id) });

  const record = client.data;
  const linkedProcesses = (processes.data ?? []).filter((process) => process.clientId === id);
  const linkedCalculations = calculations.data ?? [];

  const update = useMutation({
    mutationFn: (data) => api.put(`/api/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
      personType,
      name: data.get("name"),
      document: data.get("document"),
      email: data.get("email"),
      phone: data.get("phone"),
      notes: data.get("notes"),
      status: data.get("status"),
    });
  }

  function startEditing() {
    setPersonType(record?.personType ?? "Pessoa física");
    setFormError("");
    setEditing(true);
  }

  return (
    <AppShell>
      <section className="workspace module-workspace">
        <Link className="record-back" href="/clientes"><ArrowLeft size={16} /> Voltar para clientes</Link>

        {loadMessage(client, processes, calculations) && <div className="module-status" role="status">{loadMessage(client, processes, calculations)}</div>}

        {record && <>
          <header className="module-header">
            <div><span className="module-eyebrow">{record.personType}</span><h1>{record.name}</h1><p>Cadastrado em {formatDate(record.createdAt)}</p></div>
            <div className="top-actions module-actions">
              <button className="secondary-button" type="button" onClick={editing ? () => setEditing(false) : startEditing}>{editing ? <X size={16} /> : <Pencil size={16} />} {editing ? "Cancelar edição" : "Editar cliente"}</button>
              <span className={`status-pill ${record.status === "Ativo" ? "success" : "warning"}`}>{record.status}</span>
            </div>
          </header>

          <div className="stat-grid">
            <Stat label="Processos vinculados" value={String(linkedProcesses.length)} hint="Consultas e demandas" />
            <Stat label="Cálculos vinculados" value={String(linkedCalculations.length)} hint="Memórias registradas" />
            <Stat label="Documento" value={formatRequired(record.document)} hint={formatRequired(record.email)} />
          </div>

          <div className="detail-grid">
            <aside className="data-card index-summary">
              <div className="card-heading"><div><h2>Dados do cadastro</h2><p>{editing ? "Edite e salve as alterações" : "Informações registradas"}</p></div></div>
              <div className="index-line"><span>Tipo de pessoa</span><strong>{record.personType}</strong></div>
              <div className="index-line"><span>Nome / razão social</span><strong>{record.name}</strong></div>
              <div className="index-line"><span>Documento</span><strong>{formatRequired(record.document)}</strong></div>
              <div className="index-line"><span>E-mail</span><strong>{formatRequired(record.email)}</strong></div>
              <div className="index-line"><span>Telefone</span><strong>{formatRequired(record.phone)}</strong></div>
              <div className="index-line"><span>Situação</span><strong>{record.status}</strong></div>
              {record.notes && <div className="index-line"><span>Observações</span><strong>{record.notes}</strong></div>}

              {editing && <form className="link-editor" onSubmit={handleSubmit}>
                <div className="choice-group" aria-label="Tipo de pessoa">
                  {["Pessoa física", "Pessoa jurídica"].map((type) => <button className={personType === type ? "active" : ""} key={type} onClick={() => setPersonType(type)} type="button">{type}</button>)}
                </div>
                <div className="fields-grid compact">
                  <label className="field field-wide"><span>Nome completo / razão social *</span><input defaultValue={record.name} name="name" required /></label>
                  <label className="field"><span>Documento</span><input defaultValue={record.document ?? ""} name="document" /></label>
                  <label className="field"><span>Situação</span><select defaultValue={record.status} name="status"><option>Ativo</option><option>Inativo</option></select></label>
                  <label className="field"><span>E-mail</span><input defaultValue={record.email ?? ""} name="email" type="email" /></label>
                  <label className="field"><span>Telefone</span><input defaultValue={record.phone ?? ""} name="phone" /></label>
                  <label className="field field-wide"><span>Observações</span><textarea defaultValue={record.notes ?? ""} name="notes" rows="3" /></label>
                </div>
                {formError && <p className="field-error" role="alert">{formError}</p>}
                <div className="link-editor-actions"><button className="back-button" type="button" onClick={() => setEditing(false)}>Cancelar</button><button className="primary-button" disabled={update.isPending} type="submit">{update.isPending ? <Loader2 className="spinning" size={17} /> : <Pencil size={16} />} Salvar alterações</button></div>
              </form>}
            </aside>

            <article className="data-card">
              <div className="card-heading"><div><h2>Processos vinculados</h2><p>Demandas e contratos deste cliente</p></div></div>
              <div className="link-list">
                {linkedProcesses.length === 0 && <p className="empty-state"><FileText size={26} /><strong>Nenhum processo vinculado</strong><span>Crie um processo e vincule este cliente.</span></p>}
                {linkedProcesses.map((process) => (
                  <Link className="index-line link-line" href={`/processos/${process.id}`} key={process.id}>
                    <span><strong>{process.title || process.number}</strong><small>{process.number ? `Nº ${process.number}` : ""}</small></span>
                    <span>{statusPill(process.status)}</span>
                  </Link>
                ))}
              </div>
              <div className="card-heading"><div><h2>Cálculos vinculados</h2><p>Memórias de cálculo deste cliente</p></div></div>
              <div className="link-list">
                {linkedCalculations.length === 0 && <p className="empty-state"><Calculator size={26} /><strong>Nenhum cálculo vinculado</strong><span>Não há memórias de cálculo para este cliente ainda.</span></p>}
                {linkedCalculations.map((calculation) => (
                  <Link className="index-line link-line" href={`/calculos/${calculation.id}`} key={calculation.id}>
                    <span><strong>{calculation.title}</strong><small>{calculation.calculationType} · {calculation.indexSlug ? indexLabel(calculation.indexSlug) : "Sem correção"}</small></span>
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
  const normalized = String(value).toLocaleLowerCase("pt-BR");
  const tone = normalized === "ativo" || normalized === "concluído" ? "success" : normalized === "inativo" || normalized === "rascunho" ? "warning" : "neutral";
  return <span className={`status-pill ${tone}`}>{value}</span>;
}

function loadMessage(client, processes, calculations) {
  if (client.isLoading || processes.isLoading || calculations.isLoading) return "Carregando dados do cliente...";
  if (client.isError || processes.isError || calculations.isError) return "Não foi possível carregar os dados. Verifique se a API está em execução.";
  return null;
}