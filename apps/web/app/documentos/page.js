"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";
import { api, formatDate, formatRequired } from "../../lib/api";

const columns = [
  { key: "name", label: "Documento", width: "1.7fr" },
  { key: "category", label: "Categoria" },
  { key: "source", label: "Vinculado a", width: "1.2fr" },
  { key: "date", label: "Enviado em" },
  { key: "status", label: "Situação" },
];

export default function DocumentsPage() {
  const query = useQuery({ queryKey: ["documents"], queryFn: () => api.get("/api/documents") });
  const rows = (query.data ?? []).map(mapDocument);
  const stats = documentStats(query.data ?? []);

  return (
    <AppShell>
      <ModulePage
        eyebrow="ARQUIVOS"
        title="Documentos"
        description="Consulte documentos, planilhas e memórias vinculadas aos cálculos."
        actionLabel="Novo documento"
        actionHref="/documentos/novo"
        columns={columns}
        rows={rows}
        statusMessage={loadMessage(query)}
        stats={stats}
      />
    </AppShell>
  );
}

function mapDocument(item) {
  return {
    id: item.id,
    name: item.title,
    category: formatRequired(item.category),
    source: item.process?.title ?? formatRequired(item.source ?? "Sem vínculo"),
    date: formatDate(item.createdAt),
    status: item.status ?? "Em revisão",
  };
}

function documentStats(documents) {
  const total = documents.length;
  const reviewing = documents.filter((document) => document.status === "Em revisão").length;
  const validated = documents.filter((document) => document.status === "Validado").length;
  return [
    { label: "Documentos", value: String(total), hint: "Registrados" },
    { label: "Em revisão", value: String(reviewing), hint: "Aguardando conferência" },
    { label: "Validados", value: String(validated), hint: "Confirmados" },
  ];
}

function loadMessage(query) {
  if (query.isLoading) return "Carregando documentos...";
  if (query.isError) return "Não foi possível carregar os documentos. Verifique se a API está em execução.";
  return null;
}