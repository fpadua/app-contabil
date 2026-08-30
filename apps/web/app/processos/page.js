"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";
import { readRecords, RECORD_KEYS } from "../../lib/local-records";

const columns = [
  { key: "process", label: "Processo/contrato", width: "1.5fr" },
  { key: "client", label: "Cliente", width: "1.2fr" },
  { key: "type", label: "Tipo de cálculo", width: "1.1fr" },
  { key: "updated", label: "Atualizado em", width: ".85fr" },
  { key: "status", label: "Situação", width: ".8fr" },
];
const rows = [
  { id: 1, process: "Processo 0001245-32.2025", client: "Cliente demonstrativo A", type: "Correção monetária", updated: "30/08/2026", status: "Em andamento" },
  { id: 2, process: "Contrato habitacional 2021", client: "Cliente demonstrativo B", type: "Financiamento SAC", updated: "29/08/2026", status: "Em revisão" },
  { id: 3, process: "Processo 0000871-19.2024", client: "Cliente demonstrativo C", type: "Diferença salarial", updated: "27/08/2026", status: "Concluído" },
  { id: 4, process: "Acordo judicial 042", client: "Cliente demonstrativo D", type: "Cálculo judicial", updated: "25/08/2026", status: "Concluído" },
];

export default function ProcessesPage() {
  const [visibleRows, setVisibleRows] = useState(rows);
  useEffect(() => setVisibleRows([...readRecords(RECORD_KEYS.processes), ...rows]), []);

  return <AppShell><ModulePage eyebrow="GESTÃO" title="Processos" description="Organize contratos, demandas e cálculos relacionados." actionLabel="Novo processo" actionHref="/processos/novo" columns={columns} rows={visibleRows} stats={[{ label: "Processos ativos", value: "18", hint: "+3 no mês" }, { label: "Em conferência", value: "5", hint: "2 prioritários" }, { label: "Concluídos", value: "64", hint: "Histórico completo" }]} /></AppShell>;
}
