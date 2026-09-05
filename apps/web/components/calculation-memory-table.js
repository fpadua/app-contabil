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
  if (data.params?.calculationMode === "detailed") return <DetailedSalaryTable data={data} ariaLabel={ariaLabel} />;
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

function DetailedSalaryTable({ data, ariaLabel }) {
  const detailedColumns = [
    { key: "competence", label: "Competência" },
    { key: "description", label: "Evento" },
    { key: "difference", label: "Diferença" },
    { key: "corrected", label: "Atualizado" },
    { key: "interest", label: "Juros" },
    { key: "selic", label: "Selic" },
    { key: "total", label: "Total" },
  ];
  const rows = (data.months ?? []).map((month, index) => ({
    id: `${month.referenceDate ?? month.competence}-${index}`,
    competence: month.competence,
    description: month.description,
    difference: formatCurrency(month.differenceInCents),
    corrected: formatCurrency(month.correctedInCents),
    interest: formatCurrency(month.interestInCents),
    selic: formatCurrency(month.selicInCents),
    total: formatCurrency(month.totalInCents),
  }));
  rows.push({ id: "final", competence: "TOTAL", description: "Valor devido atualizado", difference: formatCurrency(data.principalInCents), corrected: "—", interest: "—", selic: "—", total: formatCurrency(data.correctedInCents) });
  const sum = (field) => (data.months ?? []).reduce((total, month) => total + Number(month[field] ?? 0), 0);
  const totalRow = rows.at(-1);
  totalRow.difference = formatCurrency(sum("differenceInCents"));
  totalRow.corrected = formatCurrency(sum("correctedInCents"));
  totalRow.interest = formatCurrency(sum("interestInCents"));
  totalRow.selic = formatCurrency(sum("selicInCents"));
  totalRow.total = formatCurrency(sum("totalInCents"));
  const gridTemplateColumns = "minmax(90px, .8fr) minmax(150px, 1.3fr) repeat(5, minmax(110px, 1fr))";

  return <>
  <div className="result-table-scroll">
    <div className="result-table" role="table" aria-label={ariaLabel ?? "Memória detalhada de diferenças salariais"} style={{ minWidth: "920px" }}>
      <div className="result-row header" role="row" style={{ gridTemplateColumns }}>
        {detailedColumns.map((column) => <span key={column.key} role="columnheader">{column.label}</span>)}
      </div>
      {rows.map((row) => <div className={`result-row ${row.id === "final" ? "totals" : ""}`} key={row.id} role="row" style={{ gridTemplateColumns }}>
        {detailedColumns.map((column) => <span key={column.key} role="cell">{row[column.key]}</span>)}
      </div>)}
    </div>
  </div>
  <DetailedSalarySummary data={data} />
  </>;
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
