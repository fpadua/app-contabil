"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";
import { api, formatDate, formatRequired } from "../../lib/api";

const columns = [
  { key: "process", label: "Processo/contrato", width: "1.5fr" },
  { key: "client", label: "Cliente", width: "1.2fr" },
  { key: "type", label: "Tipo de cálculo", width: "1.1fr" },
  { key: "updated", label: "Atualizado em", width: ".85fr" },
  { key: "status", label: "Situação", width: ".8fr" },
];

export default function ProcessesPage() {
  const query = useQuery({ queryKey: ["processes"], queryFn: () => api.get("/api/processes") });
  const rows = (query.data ?? []).map(mapProcess);
  const stats = processStats(query.data ?? []);

  return (
    <AppShell>
      <ModulePage
        eyebrow="GESTÃO"
        title="Processos"
        description="Organize contratos, demandas e cálculos relacionados."
        actionLabel="Novo processo"
        actionHref="/processos/novo"
        columns={columns}
        rows={rows}
        rowHref={(row) => `/processos/${row.id}`}
        statusMessage={loadMessage(query)}
        stats={stats}
      />
    </AppShell>
  );
}

function mapProcess(item) {
  return {
    id: item.id,
    process: item.title || item.number,
    client: item.client?.name ?? "—",
    type: item.calculationType,
    updated: formatDate(item.createdAt),
    status: item.status ?? "Em andamento",
  };
}

function processStats(processes) {
  const total = processes.length;
  const active = processes.filter((process) => process.status === "Em andamento").length;
  const reviewing = processes.filter((process) => process.status === "Em revisão").length;
  const finished = processes.filter((process) => process.status === "Concluído").length;
  return [
    { label: "Processos ativos", value: String(active), hint: `${total} no total` },
    { label: "Em conferência", value: String(reviewing), hint: "Aguardando revisão" },
    { label: "Concluídos", value: String(finished), hint: "Histórico" },
  ];
}

function loadMessage(query) {
  if (query.isLoading) return "Carregando processos...";
  if (query.isError) return "Não foi possível carregar os processos. Verifique se a API está em execução.";
  return null;
}