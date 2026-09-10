"use client";

import { useEffect, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { formatCurrency, formatDate, formatFactor } from "../lib/api";

const columns = [
  { key: "competence", label: "Competência" },
  { key: "description", label: "Descritivo", width: "minmax(150px, 1.3fr)" },
  { key: "amount", label: "Valor" },
  { key: "factor", label: "Fator" },
  { key: "accumulated", label: "Fator acumulado" },
  { key: "corrected", label: "Valor corrigido" },
];

export function CalculationMemoryTable({ data, indexLabel, ariaLabel }) {
  if (data.params?.calculationMode === "detailed") return <DetailedSalaryTable data={data} indexLabel={indexLabel} ariaLabel={ariaLabel} />;
  const rows = (data.months ?? []).map((month) => ({
    id: month.referenceDate ?? month.competence,
    competence: month.competence,
    description: `Correção monetária — ${indexLabel}`,
    amount: formatCurrency(data.principalInCents),
    factor: formatFactor(month.factor),
    accumulated: formatFactor(month.accumulatedFactor),
    corrected: formatCurrency(month.correctedInCents),
  }));
  const totalRow = {
    id: "final",
    competence: "TOTAL",
    description: "Valor atualizado no fim do período",
    amount: formatCurrency(data.principalInCents),
    factor: "—",
    accumulated: formatFactor(data.accumulatedFactor),
    corrected: formatCurrency(data.correctedInCents),
  };
  const allRows = [...rows, totalRow];
  const gridTemplateColumns = columns.map((column) => column.width ?? "minmax(118px, 1fr)").join(" ");

  return (
    <div className="result-table-scroll">
      <div className="result-table" role="table" aria-label={ariaLabel ?? "Memória de cálculo"} style={{ minWidth: `${Math.max(columns.length * 128, 620)}px` }}>
        <div className="result-row header" role="row" style={{ gridTemplateColumns }}>
          {columns.map((column) => <span key={column.key} role="columnheader">{column.label}</span>)}
        </div>
        {allRows.map((row) => <div className={`result-row ${row.id === "final" ? "totals" : ""}`} key={row.id} role="row" style={{ gridTemplateColumns }}>
          {columns.map((column) => <span key={column.key} role="cell">{row[column.key]}</span>)}
        </div>)}
      </div>
    </div>
  );
}

const DETAILED_COLUMN_DEFS = [
  { key: "competence", label: "Competência", width: "minmax(90px, .8fr)", defaultVisible: true },
  { key: "description", label: "Evento", width: "minmax(150px, 1.3fr)", defaultVisible: true },
  { key: "adjustmentIndex", label: "Índice de reajuste", width: "minmax(110px, 1fr)" },
  { key: "due", label: "Valor devido do subsídio", width: "minmax(120px, 1fr)" },
  { key: "received", label: "Valor recebido do subsídio", width: "minmax(120px, 1fr)" },
  { key: "difference", label: "Valor da diferença", width: "minmax(120px, 1fr)", defaultVisible: true },
  { key: "correctionIndex", label: "Índice de atualização", width: "minmax(120px, 1fr)" },
  { key: "corrected", label: "Valor da diferença atualizado", width: "minmax(130px, 1fr)", defaultVisible: true },
  { key: "savingsRate", label: "Juros", width: "minmax(90px, 1fr)" },
  { key: "interest", label: "Valor dos juros", width: "minmax(120px, 1fr)", defaultVisible: true },
  { key: "subtotal", label: "Valor da diferença com correção e juros", width: "minmax(150px, 1fr)" },
  { key: "selicRate", label: "Taxa Selic", width: "minmax(90px, 1fr)" },
  { key: "selic", label: "Valor da Selic", width: "minmax(120px, 1fr)", defaultVisible: true },
  { key: "total", label: "Valor da diferença corrigido com juros e selic", width: "minmax(140px, 1fr)", defaultVisible: true },
];

const DEFAULT_VISIBLE_COLUMNS = DETAILED_COLUMN_DEFS.filter((column) => column.defaultVisible).map((column) => column.key);
const DETAILED_COLUMNS_KEY = "salary-detailed-columns";

function DetailedSalaryTable({ data, indexLabel, ariaLabel }) {
  const [visible, setVisible] = useState(() => new Set(DEFAULT_VISIBLE_COLUMNS));
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DETAILED_COLUMNS_KEY);
      if (saved) {
        const keys = JSON.parse(saved).filter((key) => DETAILED_COLUMN_DEFS.some((column) => column.key === key));
        if (keys.length) setVisible(new Set(keys));
      }
    } catch {
      // preferência inválida; mantém o padrão
    }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(DETAILED_COLUMNS_KEY, JSON.stringify([...visible])); } catch { /* sem armazenamento */ }
  }, [visible]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event) => { if (pickerRef.current && !pickerRef.current.contains(event.target)) setPickerOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pickerOpen]);

  const columns = DETAILED_COLUMN_DEFS.filter((column) => visible.has(column.key));
  const rows = (data.months ?? []).map((month, index) => buildSalaryRow(data.months, index));
  rows.push(buildSalaryTotalRow(data.months ?? []));
  const gridTemplateColumns = columns.map((column) => column.width ?? "minmax(110px, 1fr)").join(" ");
  const minWidth = Math.max(columns.length * 132, 640);

  const toggleColumn = (key) => setVisible((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return <>
    <div className="result-toolbar">
      <div className="column-picker" ref={pickerRef}>
        <button className="secondary-button" aria-expanded={pickerOpen} type="button" onClick={() => setPickerOpen((open) => !open)}><Columns3 size={15} /> Colunas</button>
        {pickerOpen && <div className="column-picker-panel" role="group" aria-label="Exibir colunas">
          {DETAILED_COLUMN_DEFS.map((column) => {
            const checked = visible.has(column.key);
            return <label className={checked ? "checked" : ""} key={column.key}>
              <input checked={checked} onChange={() => toggleColumn(column.key)} type="checkbox" /><span>{column.label}</span>
            </label>;
          })}
          <div className="column-picker-actions">
            <button type="button" onClick={() => setVisible(new Set(DEFAULT_VISIBLE_COLUMNS))}>Padrão</button>
            <button type="button" onClick={() => setVisible(new Set(DETAILED_COLUMN_DEFS.map((column) => column.key)))}>Todas</button>
          </div>
        </div>}
      </div>
    </div>
    <div className="result-table-scroll">
      <div className="result-table" role="table" aria-label={ariaLabel ?? "Memória detalhada de diferenças salariais"} style={{ minWidth }}>
        <div className="result-row header" role="row" style={{ gridTemplateColumns }}>
          {columns.map((column) => <span key={column.key} role="columnheader">{column.label}</span>)}
        </div>
        {rows.map((row) => <div className={`result-row ${row.id === "final" ? "totals" : ""}`} key={row.id} role="row" style={{ gridTemplateColumns }}>
          {columns.map((column) => <span key={column.key} role="cell">{row[column.key]}</span>)}
        </div>)}
      </div>
    </div>
    <DetailedSalarySummary data={data} />
  </>;
}

function buildSalaryRow(months, index) {
  const month = months[index];
  const next = months[index + 1];
  return {
    id: `${month.referenceDate ?? month.competence}-${index}`,
    competence: month.competence,
    description: month.description,
    adjustmentIndex: formatMonthlyRate(month.correctionFactor, next?.correctionFactor),
    due: formatCentsOrDash(month.dueInCents),
    received: formatCentsOrDash(month.receivedInCents),
    difference: formatCentsOrDash(month.differenceInCents),
    correctionIndex: formatFactorOrDash(month.correctionFactor),
    corrected: formatCentsOrDash(month.correctedInCents),
    savingsRate: formatRate(month.interestRate),
    interest: formatCentsOrDash(month.interestInCents),
    subtotal: monthsPairSum(month, "correctedInCents", "interestInCents"),
    selicRate: formatRate(month.selicRate),
    selic: formatCentsOrDash(month.selicInCents),
    total: formatCentsOrDash(month.totalInCents),
  };
}

function buildSalaryTotalRow(months) {
  const sum = (field) => months.reduce((total, month) => { const value = Number(month[field]); return Number.isFinite(value) ? total + value : total; }, 0);
  return {
    id: "final",
    competence: "TOTAL",
    description: "Valor devido atualizado",
    adjustmentIndex: "—",
    due: formatCurrency(sum("dueInCents")),
    received: formatCurrency(sum("receivedInCents")),
    difference: formatCurrency(sum("differenceInCents")),
    correctionIndex: "—",
    corrected: formatCurrency(sum("correctedInCents")),
    savingsRate: "—",
    interest: formatCurrency(sum("interestInCents")),
    subtotal: formatCurrency(sum("correctedInCents") + sum("interestInCents")),
    selicRate: "—",
    selic: formatCurrency(sum("selicInCents")),
    total: formatCurrency(sum("totalInCents")),
  };
}

function formatCentsOrDash(value) {
  return value == null ? "—" : formatCurrency(Number(value));
}

function formatFactorOrDash(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatFactor(numeric) : "—";
}

function formatMonthlyRate(currentFactor, nextFactor) {
  const current = Number(currentFactor);
  const next = Number(nextFactor);
  if (!Number.isFinite(current) || !Number.isFinite(next) || current <= 0 || next <= 0) return "—";
  const rate = (current / next - 1) * 100;
  return `${rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

function formatRate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${(numeric * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%` : "—";
}

function monthsPairSum(month, left, right) {
  const a = Number(month[left]);
  const b = Number(month[right]);
  return Number.isFinite(a) && Number.isFinite(b) ? formatCurrency(a + b) : "—";
}

function DetailedSalarySummary({ data }) {
  const sum = (field) => (data.months ?? []).reduce((total, month) => total + Number(month[field] ?? 0), 0);
  const differenceInCents = sum("differenceInCents");
  const correctedInCents = sum("correctedInCents");
  const interestInCents = sum("interestInCents");
  const selicInCents = sum("selicInCents");
  const rows = [
    { label: "VALOR DEVIDO DO SUBSÍDIO", value: sum("dueInCents") },
    { label: "VALOR RECEBIDO DO SUBSÍDIO", value: -sum("receivedInCents") },
    { label: "VALOR DA CORREÇÃO", value: correctedInCents - differenceInCents },
    { label: "VALOR DOS JUROS", value: interestInCents },
    { label: "VALOR DA SELIC", value: selicInCents },
    { label: "VALOR A SER PAGO", value: sum("totalInCents"), total: true },
  ];
  const period = `${formatDate(data.startDate)} a ${formatDate(data.endDate)}`;

  return <section className="salary-result-summary" aria-label={`Resumo do período de ${period}`}>
    <strong>Resumo do período de {period}</strong>
    <div className="salary-result-summary-table">
      {rows.map((row) => <div className={row.total ? "total" : ""} key={row.label}>
        <span>{formatDate(data.endDate)}</span><b>{row.label}</b><strong>{formatCurrency(row.value)}</strong>
      </div>)}
    </div>
  </section>;
}
