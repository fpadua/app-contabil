import { accumulateSeriesFactors } from "./index.js";

function roundCents(value) {
  return Math.round(Number(value));
}

function assertScheduleInput({ principalInCents, monthlyInterestRate, months }) {
  if (!Number.isInteger(principalInCents) || principalInCents <= 0) throw new TypeError("principalInCents must be a positive integer");
  if (!Number.isFinite(monthlyInterestRate) || monthlyInterestRate < 0) throw new TypeError("monthlyInterestRate must be a non-negative finite number");
  if (!Number.isInteger(months) || months <= 0) throw new TypeError("months must be a positive integer");
}

/**
 * REGRA-SAC-001/002 (núcleo): `Amortização constante`.
 * Amortização = principal / número de parcelas; juros sobre o saldo devedor; a última
 * parcela absorve o saldo remanescente (diferença de centavos do arredondamento).
 */
export function sacSchedule({ principalInCents, monthlyInterestRate, months }) {
  assertScheduleInput({ principalInCents, monthlyInterestRate, months });
  const amortization = Math.round(principalInCents / months);
  let balance = principalInCents;
  const rows = [];
  for (let index = 1; index <= months; index += 1) {
    const isLast = index === months;
    const interest = roundCents(balance * monthlyInterestRate);
    const principalShare = isLast ? balance : Math.min(amortization, balance);
    const installment = interest + principalShare;
    balance = Math.max(balance - principalShare, 0);
    rows.push(rowData({ index, amortizationInCents: principalShare, interestInCents: interest, installmentInCents: installment, remainingInCents: balance }));
  }
  return rows;
}

/**
 * REGRA-SAC-001/002 (com correção): `SAC corrigido mensalmente pelo índice`.
 * O saldo original é corrigido pelo fator acumulado antes de apurar juros; a amortização
 * nominal é constante (principal/parcelas) e a última parcela absorve o saldo corrigido.
 */
export function sacIndexedSchedule({ principalInCents, monthlyInterestRate, monthlyStats }) {
  if (!Array.isArray(monthlyStats) || monthlyStats.length === 0) throw new TypeError("monthlyStats must be a non-empty array");
  const { perMonth } = accumulateSeriesFactors(monthlyStats);
  const months = perMonth.length;
  assertScheduleInput({ principalInCents, monthlyInterestRate, months });
  const amortization = Math.round(principalInCents / months);
  let originalBalance = principalInCents;
  const rows = [];
  perMonth.forEach((month, index) => {
    const isLast = index === months - 1;
    const correctedBalance = roundCents(originalBalance * month.accumulatedFactor);
    const interest = roundCents(correctedBalance * monthlyInterestRate);
    const principalShare = isLast ? originalBalance : Math.min(amortization, originalBalance);
    const installment = interest + roundCents(principalShare * month.accumulatedFactor);
    originalBalance = Math.max(originalBalance - principalShare, 0);
    rows.push(rowData({
      index: index + 1,
      competence: month.referenceDate,
      factor: month.factor,
      accumulatedFactor: month.accumulatedFactor,
      amortizationInCents: roundCents(principalShare * month.accumulatedFactor),
      interestInCents: interest,
      installmentInCents: installment,
      remainingInCents: roundCents(originalBalance * month.accumulatedFactor),
    }));
  });
  return rows;
}

/**
 * REGRA-PRICE-001 (núcleo): `Prestação constante`.
 * Prestação = P * i / (1 - (1 + i)^-n); juros sobre o saldo devedor; a última parcela
 * absorve o saldo remanescente.
 */
export function priceSchedule({ principalInCents, monthlyInterestRate, months }) {
  assertScheduleInput({ principalInCents, monthlyInterestRate, months });
  const monthlyRate = monthlyInterestRate;
  const baseInstallment = monthlyRate === 0
    ? principalInCents / months
    : (principalInCents * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  const rows = [];
  let balance = principalInCents;
  for (let index = 1; index <= months; index += 1) {
    const isLast = index === months;
    const interest = roundCents(balance * monthlyRate);
    const principalShare = isLast ? balance : Math.min(roundCents(baseInstallment) - interest, balance);
    if (principalShare <= 0) throw new TypeError("monthlyInterestRate too high for the installment length");
    balance = Math.max(balance - principalShare, 0);
    rows.push(rowData({ index, amortizationInCents: principalShare, interestInCents: interest, installmentInCents: interest + principalShare, remainingInCents: balance }));
  }
  return rows;
}

/**
 * REGRA-PRICE-001 (com correção): `PRICE com prestação corrigida pelo índice`.
 * A prestação constante é corrigida pelo fator acumulado; juros sobre o saldo devedor
 * anterior corrigido; a última parcela absorve o saldo remanescente.
 */
export function priceIndexedSchedule({ principalInCents, monthlyInterestRate, monthlyStats }) {
  if (!Array.isArray(monthlyStats) || monthlyStats.length === 0) throw new TypeError("monthlyStats must be a non-empty array");
  const { perMonth } = accumulateSeriesFactors(monthlyStats);
  const months = perMonth.length;
  assertScheduleInput({ principalInCents, monthlyInterestRate, months });
  const monthlyRate = monthlyInterestRate;
  const baseInstallment = monthlyRate === 0
    ? principalInCents / months
    : (principalInCents * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  let balance = principalInCents;
  const rows = [];
  perMonth.forEach((month, index) => {
    const isLast = index === months - 1;
    const interest = roundCents(balance * monthlyRate);
    const correctedInstallment = roundCents(baseInstallment * month.accumulatedFactor);
    const principalShare = isLast ? balance : Math.min(correctedInstallment - interest, balance);
    if (principalShare <= 0) throw new TypeError("monthlyInterestRate too high for the installment length");
    balance = Math.max(balance - principalShare, 0);
    rows.push(rowData({
      index: index + 1,
      competence: month.referenceDate,
      factor: month.factor,
      accumulatedFactor: month.accumulatedFactor,
      amortizationInCents: principalShare,
      interestInCents: interest,
      installmentInCents: interest + principalShare,
      remainingInCents: balance,
    }));
  });
  return rows;
}

function rowData(data) {
  const row = { installmentNumber: data.index };
  if (data.competence) row.competence = data.competence;
  if (data.factor !== undefined) row.factor = data.factor;
  if (data.accumulatedFactor !== undefined) row.accumulatedFactor = data.accumulatedFactor;
  row.amortizationInCents = data.amortizationInCents;
  row.interestInCents = data.interestInCents;
  row.installmentInCents = data.installmentInCents;
  row.remainingInCents = data.remainingInCents;
  return row;
}