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

/**
 * REGRA-DIF-002: memória detalhada de diferenças remuneratórias.
 *
 * Cada lançamento representa uma competência (incluindo 13º e férias) e
 * conserva os fatores já definidos na memória de cálculo. A ordem das
 * operações é a mesma da planilha de referência: diferença, correção,
 * juros e Selic. Os valores somente são arredondados ao gravar em centavos.
 */
export function detailedSalaryDifferenceSchedule({ entries }) {
  if (!Array.isArray(entries) || entries.length === 0) throw new TypeError("entries must be a non-empty array");

  const months = entries.map((entry, index) => {
    const dueInCents = Number(entry.dueInCents);
    const receivedInCents = Number(entry.receivedInCents);
    const correctionFactor = Number(entry.correctionFactor);
    const interestRate = Number(entry.interestRate);
    const selicRate = Number(entry.selicRate);
    if (!Number.isFinite(dueInCents) || !Number.isFinite(receivedInCents) || dueInCents <= receivedInCents) {
      throw new TypeError(`entry ${index + 1} must have dueInCents greater than receivedInCents`);
    }
    if (![correctionFactor, interestRate, selicRate].every(Number.isFinite) || correctionFactor <= 0 || interestRate < 0 || selicRate < 0) {
      throw new TypeError(`entry ${index + 1} has invalid factors`);
    }

    const rawDifferenceInCents = dueInCents - receivedInCents;
    const rawCorrectedInCents = rawDifferenceInCents * correctionFactor;
    const rawInterestInCents = rawCorrectedInCents * interestRate;
    const rawSubtotalInCents = rawCorrectedInCents + rawInterestInCents;
    const rawSelicInCents = rawSubtotalInCents * selicRate;
    return {
      referenceDate: entry.referenceDate ?? null,
      competence: entry.competence,
      description: entry.description ?? "Diferença remuneratória",
      dueInCents,
      receivedInCents,
      differenceInCents: roundCents(rawDifferenceInCents),
      correctionFactor,
      correctedInCents: roundCents(rawCorrectedInCents),
      interestRate,
      interestInCents: roundCents(rawInterestInCents),
      selicRate,
      selicInCents: roundCents(rawSelicInCents),
      totalInCents: roundCents(rawSubtotalInCents + rawSelicInCents),
      rawDifferenceInCents,
      rawCorrectedInCents,
      rawInterestInCents,
      rawSelicInCents,
      rawTotalInCents: rawSubtotalInCents + rawSelicInCents,
    };
  });

  const total = (field) => months.reduce((sum, month) => sum + month[field], 0);
  const principalInCents = roundCents(total("rawDifferenceInCents"));
  const correctedInCents = roundCents(total("rawTotalInCents"));
  return {
    months,
    principalInCents,
    correctedInCents,
    correctionInCents: correctedInCents - principalInCents,
    summary: {
      dueInCents: roundCents(total("dueInCents")),
      receivedInCents: roundCents(total("receivedInCents")),
      monetaryCorrectionInCents: roundCents(total("rawCorrectedInCents")) - principalInCents,
      interestInCents: roundCents(total("rawInterestInCents")),
      selicInCents: roundCents(total("rawSelicInCents")),
    },
  };
}
