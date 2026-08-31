import { accumulateSeriesFactors } from "./index.js";

function roundCents(value) {
  return Math.round(Number(value));
}

function competenceOf(referenceDate) {
  const date = new Date(referenceDate);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

/**
 * REGRA-DIF-001 (proposta documentada): `Diferenças salariais com reflexos`.
 * 1. Diferença mensal {novo - anterior} corrigida mês a mês pelo índice acumulado.
 * 2. Reflexo de 13º: (soma corrigida) / 12.
 * 3. Reflexo de férias: (soma corrigida / 12) * 4/3 (1 + 1/3 do terço constitucional).
 * Total = soma corrigida + reflexos. Verte em linguagem de regra; revisão obrigatória.
 */
export function salaryDifferenceSchedule({ monthlyDifferenceInCents, monthlyStats, reflections = { decimoTerceiro: true, vacationsWithBonus: true } }) {
  if (!Number.isInteger(monthlyDifferenceInCents) || monthlyDifferenceInCents <= 0) throw new TypeError("monthlyDifferenceInCents must be a positive integer");
  if (!Array.isArray(monthlyStats) || monthlyStats.length === 0) throw new TypeError("monthlyStats must be a non-empty array");

  const { perMonth } = accumulateSeriesFactors(monthlyStats);
  const months = perMonth.map((month) => ({
    referenceDate: month.referenceDate,
    competence: competenceOf(month.referenceDate),
    factor: month.factor,
    accumulatedFactor: month.accumulatedFactor,
    correctedInCents: roundCents(monthlyDifferenceInCents * month.accumulatedFactor),
  }));

  const sumCorrectedInCents = months.reduce((sum, month) => sum + month.correctedInCents, 0);
  const monthlyAverage = sumCorrectedInCents / 12;
  const decimoTerceiroInCents = reflections.decimoTerceiro ? roundCents(monthlyAverage) : 0;
  const vacationsInCents = reflections.vacationsWithBonus ? roundCents(monthlyAverage * (4 / 3)) : 0;
  const correctedInCents = sumCorrectedInCents + decimoTerceiroInCents + vacationsInCents;

  return {
    accumulatedFactor: perMonth[perMonth.length - 1].accumulatedFactor,
    months,
    sumCorrectedInCents,
    decimoTerceiroInCents,
    vacationsInCents,
    correctedInCents,
    correctionInCents: correctedInCents - monthlyDifferenceInCents,
    params: { reflections, monthlyDifferenceInCents },
  };
}