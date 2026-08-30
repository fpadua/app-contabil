"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
const columns = [
  { key: "index", label: "Índice", width: "1.1fr" }, { key: "reference", label: "Competência" },
  { key: "monthly", label: "Variação mensal" }, { key: "accumulated", label: "Acumulado" },
  { key: "source", label: "Fonte" }, { key: "status", label: "Situação" },
];
const demoRows = [
  { id: 1, index: "IPCA", reference: "07/2026", monthly: "0,07%", accumulated: "—", source: "IBGE", status: "Demonstração" },
  { id: 2, index: "INPC", reference: "07/2026", monthly: "-0,01%", accumulated: "—", source: "IBGE", status: "Demonstração" },
  { id: 3, index: "IGP-M", reference: "07/2026", monthly: "-1,16%", accumulated: "2,77%", source: "FGV", status: "Demonstração" },
  { id: 4, index: "TR", reference: "08/2026", monthly: "0,1693%", accumulated: "—", source: "Bacen", status: "Demonstração" },
];

export default function IndicesPage() {
  const queryClient = useQueryClient();
  const indices = useQuery({ queryKey: ["economic-indices"], queryFn: fetchIndices });
  const sync = useMutation({ mutationFn: synchronizeIndices, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["economic-indices"] }) });
  const rows = indices.data?.length ? indices.data.map(mapIndex) : demoRows;
  const statusMessage = sync.isSuccess
    ? `Sincronização ${sync.data.status.toLocaleLowerCase("pt-BR")}: ${sync.data.inserted} inclusões e ${sync.data.updated} atualizações.`
    : sync.isError ? sync.error.message
    : indices.isError ? "API ou banco ainda não configurados. Exibindo dados demonstrativos." : null;

  return <AppShell><ModulePage eyebrow="BASE ECONÔMICA" title="Índices econômicos" description="Consulte competências, fontes e o estado das séries utilizadas nos cálculos." actionLabel={sync.isPending ? "Atualizando..." : "Atualizar índices"} actionIcon="refresh" actionDisabled={sync.isPending} onAction={() => sync.mutate()} statusMessage={statusMessage} columns={columns} rows={rows} stats={[{ label: "Índices ativos", value: String(indices.data?.length ?? 5), hint: "Séries monitoradas" }, { label: "Última verificação", value: indices.data ? "Agora" : "Demonstração", hint: "Sincronização auditável" }, { label: "Pendências", value: sync.data?.failed ? String(sync.data.failed) : "0", hint: "Competências indisponíveis" }]} /></AppShell>;
}

async function fetchIndices() {
  const response = await fetch(`${apiUrl}/api/indices`);
  if (!response.ok) throw new Error("Não foi possível consultar os índices.");
  return response.json();
}

async function synchronizeIndices() {
  const response = await fetch(`${apiUrl}/api/indices/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? "Não foi possível sincronizar os índices.");
  return payload;
}

function mapIndex(item) {
  const latest = item.values?.[0];
  return { id: item.id, index: item.name, reference: latest ? formatPeriod(latest.referenceDate) : "Sem dados", monthly: formatDecimal(latest?.monthlyValue, "%"), accumulated: formatDecimal(latest?.accumulatedValue, "%"), source: item.source, status: latest?.published ? "Atualizado" : "Pendente" };
}

function formatPeriod(value) {
  const [year, month] = String(value).slice(0, 7).split("-");
  return `${month}/${year}`;
}

function formatDecimal(value, suffix = "") {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${suffix}`;
}
