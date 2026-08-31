import { formatCurrency, formatFactor } from "../lib/api";

const columns = [
  { key: "competence", label: "Competência" },
  { key: "description", label: "Descritivo", width: "minmax(150px, 1.3fr)" },
  { key: "amount", label: "Valor" },
  { key: "factor", label: "Fator" },
  { key: "accumulated", label: "Fator acumulado" },
  { key: "corrected", label: "Valor corrigido" },
];

export function CalculationMemoryTable({ data, indexLabel, ariaLabel }) {
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