const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const HOUSING_STORAGE_KEY = "contabil:housing-planilha";

export function parseHousingNumber(value) {
  const text = String(value ?? "").trim().replace(/\s*%\s*$/, "").replace(/r\$\s*/gi, "");
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

export function formatHousingCurrency(value) {
  return currency.format(Number(value) || 0);
}

export function maskHousingCurrency(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? currency.format(Number(digits) / 100) : "";
}

export function maskHousingPercent(value) {
  const text = String(value ?? "").replace(/[^\d,.-]/g, "");
  if (!text) return "";
  return `${text.replace(".", ",")}%`;
}

export function formatMonthEnd(date) {
  return date.toLocaleDateString("pt-BR");
}

export function calculateHousingSchedule({ principal, months, monthlyRate, startDate, insurance, fee, other }) {
  const count = Math.max(1, Math.floor(Number(months) || 1));
  const base = Math.max(0, Number(principal) || 0);
  const rate = Math.max(0, Number(monthlyRate) || 0);
  const amortization = base / count;
  const rows = [];
  let balance = base;
  const firstDate = new Date(`${startDate || "2015-04-30"}T12:00:00`);
  for (let index = 1; index <= count; index += 1) {
    const date = index === 1 ? firstDate : new Date(firstDate.getFullYear(), firstDate.getMonth() + index, 0);
    const currentAmortization = index === count ? balance : Math.min(amortization, balance);
    const interest = balance * rate;
    const baseInstallment = currentAmortization + interest;
    const insuranceValue = index === 1 ? Number(insurance) || 0 : Number(insurance) || 0;
    const feeValue = index === 1 ? Number(fee) || 0 : Number(fee) || 0;
    const otherValue = index === 1 ? Number(other) || 0 : Number(other) || 0;
    const total = baseInstallment + insuranceValue + feeValue + otherValue;
    balance = Math.max(0, balance - currentAmortization);
    rows.push({ installment: index, date: formatMonthEnd(date), amortization: currentAmortization, interest, insurance: insuranceValue, fee: feeValue, other: otherValue, installmentTotal: total, balance });
  }
  return { rows, amortization, totalPaid: rows.reduce((sum, row) => sum + row.installmentTotal, 0), totalInterest: rows.reduce((sum, row) => sum + row.interest, 0), totalInsurance: rows.reduce((sum, row) => sum + row.insurance, 0), totalFees: rows.reduce((sum, row) => sum + row.fee + row.other, 0) };
}
