"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";
import { api, formatCurrency, formatDate, formatFactor } from "../../lib/api";
import { indexLabel } from "../../lib/calculation-export";

const columns = [
  { key: "title", label: "Cálculo", width: "1.4fr" },
  { key: "client", label: "Cliente" },
  { key: "type", label: "Tipo" },
  { key: "index", label: "Índice" },
  { key: "period", label: "Período" },
  { key: "factor", label: "Fator acumulado" },
  { key: "principal", label: "Valor original" },
  { key: "corrected", label: "Valor corrigido" },
  { key: "status", label: "Situação" },
];

export default function CalculationsPage() {
  const query = useQuery({ queryKey: ["calculations"], queryFn: () => api.get("/api/calculations") });
  const rows = (query.data ?? []).map(mapCalculation);

  return (
    <AppShell>
      <ModulePage
        eyebrow="CÁLCULOS"
        title="Histórico de cálculos"
        description="Cálculos salvos com memória, fonte dos índices e trilha de auditoria."
        actionLabel="Novo cálculo"
        actionHref="/calculos/novo"
        columns={columns}
        rows={rows}
        rowHref={(row) => `/calculos/${row.id}`}
        statusMessage={loadMessage(query)}
        stats={calculationStats(query.data ?? [])}
      />
    </AppShell>
  );
}

function mapCalculation(item) {
  return {
    id: item.id,
    title: item.title,
    client: item.client?.name ?? "—",
    type: item.calculationType,
    index: item.indexSlug ? indexLabel(item.indexSlug) : "Sem correção",
    period: `${formatDate(item.startDate)} a ${formatDate(item.endDate)}`,
    factor: item.accumulatedFactor ? formatFactor(item.accumulatedFactor) : "—",
    principal: formatCurrency(item.principalInCents),
    corrected: item.correctedInCents ? formatCurrency(item.correctedInCents) : "—",
    status: item.status ?? "Concluído",
  };
}

function calculationStats(calculations) {
  const total = calculations.length;
  const principal = calculations.reduce((sum, item) => sum + item.principalInCents, 0);
  const corrected = calculations.reduce((sum, item) => sum + item.correctedInCents, 0);
  const correction = corrected - principal;
  return [
    { label: "Total de cálculos", value: String(total), hint: "Salvos no sistema" },
    { label: "Correção acumulada", value: formatCurrency(correction), hint: "Soma das diferenças" },
    { label: "Valor corrigido", value: formatCurrency(corrected), hint: `${formatCurrency(principal)} originais` },
  ];
}

function loadMessage(query) {
  if (query.isLoading) return "Carregando cálculos...";
  if (query.isError) return "Não foi possível carregar os cálculos. Verifique se a API está em execução.";
  return null;
}