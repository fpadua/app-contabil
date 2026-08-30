"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { ModulePage } from "../../components/module-page";
import { readRecords, RECORD_KEYS } from "../../lib/local-records";

const columns = [
  { key: "name", label: "Documento", width: "1.7fr" },
  { key: "category", label: "Categoria" },
  { key: "source", label: "Vinculado a", width: "1.2fr" },
  { key: "date", label: "Enviado em" },
  { key: "status", label: "Situação" },
];
const rows = [
  { id: 1, name: "Memória de cálculo — Processo 042.pdf", category: "Relatório", source: "Processo 042", date: "30/08/2026", status: "Validado" },
  { id: 2, name: "Contrato habitacional.pdf", category: "Contrato", source: "Contrato 2021", date: "29/08/2026", status: "Em revisão" },
  { id: 3, name: "Demonstrativo de parcelas.xlsx", category: "Planilha", source: "Financiamento SAC", date: "28/08/2026", status: "Validado" },
];

export default function DocumentsPage() {
  const [visibleRows, setVisibleRows] = useState(rows);
  useEffect(() => setVisibleRows([...readRecords(RECORD_KEYS.documents), ...rows]), []);

  return <AppShell><ModulePage eyebrow="ARQUIVOS" title="Documentos" description="Consulte documentos, planilhas e memórias vinculadas aos cálculos." actionLabel="Novo documento" actionHref="/documentos/novo" columns={columns} rows={visibleRows} stats={[{ label: "Documentos", value: "86", hint: "12 neste mês" }, { label: "Em revisão", value: "4", hint: "Aguardando conferência" }, { label: "Armazenamento", value: "1,8 GB", hint: "Uso demonstrativo" }]} /></AppShell>;
}
