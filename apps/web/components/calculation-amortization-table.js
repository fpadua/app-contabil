import { formatCurrency } from "../lib/api";

const columns = [
  { key: "installmentNumber", label: "Parcela" },
  { key: "competence", label: "Competência", width: "minmax(92px, 1fr)" },
  { key: "principal", label: "Amortização" },
  { key: "interest", label: "Juros" },
  { key: "installment", label: "Prestação" },
  { key: "remaining", label: "Saldo devedor" },
];

function competenceText(value) {
  const date = new Date(value);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export function CalculationAmortizationTable({ data, ariaLabel }) {
  const installments = data.installments ?? [];
  const rows = installments.map((row) => ({
    id: row.installmentNumber,
    installmentNumber: String(row.installmentNumber).padStart(2, "0"),
    competence: row.competence ? competenceText(row.competence) : "—",
    principal: formatCurrency(row.amortizationInCents),
    interest: formatCurrency(row.interestInCents),
    installment: formatCurrency(row.installmentInCents),
    remaining: formatCurrency(row.remainingInCents),
  }));
  const totalPrincipal = installments.reduce((sum, row) => sum + row.amortizationInCents, 0);
  const totalInterest = installments.reduce((sum, row) => sum + row.interestInCents, 0);
  const totalInstallment = installments.reduce((sum, row) => sum + row.installmentInCents, 0);
  const allRows = [
    ...rows,
    { id: "final", installmentNumber: "TOTAL", competence: "—", principal: formatCurrency(totalPrincipal), interest: formatCurrency(totalInterest), installment: formatCurrency(totalInstallment), remaining: "—" },
  ];
  const gridTemplateColumns = columns.map((column) => column.width ?? "minmax(110px, 1fr)").join(" ");

  return (
    <div className="result-table-scroll">
      <div className="result-table" role="table" aria-label={ariaLabel ?? "Memória de amortização"} style={{ minWidth: `${Math.max(columns.length * 118, 640)}px` }}>
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