"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";
import { api, formatDate, formatRequired } from "../../lib/api";

const columns = [
  { key: "name", label: "Nome", width: "1.5fr" },
  { key: "document", label: "Documento" },
  { key: "processes", label: "Processos" },
  { key: "lastActivity", label: "Última atividade" },
  { key: "status", label: "Situação" },
];

export default function ClientsPage() {
  const query = useQuery({ queryKey: ["clients"], queryFn: () => api.get("/api/clients") });
  const rows = (query.data ?? []).map(mapClient);
  const stats = clientStats(query.data ?? []);

  return (
    <AppShell>
      <ModulePage
        eyebrow="CADASTROS"
        title="Clientes"
        description="Centralize clientes e consulte os processos vinculados."
        actionLabel="Novo cliente"
        actionHref="/clientes/novo"
        columns={columns}
        rows={rows}
        rowHref={(row) => `/clientes/${row.id}`}
        statusMessage={loadMessage(query)}
        stats={stats}
      />
    </AppShell>
  );
}

function mapClient(item) {
  return {
    id: item.id,
    name: item.name,
    document: formatRequired(item.document),
    processes: String(item._count?.processes ?? 0),
    lastActivity: formatDate(item.createdAt),
    status: item.status ?? "Ativo",
  };
}

function clientStats(clients) {
  const total = clients.length;
  const active = clients.filter((client) => client.status === "Ativo").length;
  const withProcesses = clients.filter((client) => (client._count?.processes ?? 0) > 0).length;
  return [
    { label: "Clientes ativos", value: String(active), hint: `${total} cadastrados` },
    { label: "Com processos", value: String(withProcesses), hint: total ? `${Math.round((withProcesses / total) * 100)}% da base` : "—" },
    { label: "Novos cadastros", value: "—", hint: "Últimos 30 dias" },
  ];
}

function loadMessage(query) {
  if (query.isLoading) return "Carregando clientes...";
  if (query.isError) return "Não foi possível carregar os clientes. Verifique se a API está em execução.";
  return null;
}