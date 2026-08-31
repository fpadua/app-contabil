import { accumulateSeriesFactors } from "./index.js";

function roundCents(value) {
  return Math.round(Number(value));
}

function competenceOf(referenceDate) {
  const date = new Date(referenceDate);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

/**
 * REGRA-JUD-001 (núcleo): `Correção judicial em duas fases`.
 * Fase 1: série de fatores informada (IPCA-E até 08/12/2021).
 * Fase 2: fator acumulado único (Selic a partir de 09/12/2021).
 * Resultado = principal * fatorAcumuladoFase1 * fatorAcumuladoFase2.
 */
export function judicialTwoPhaseCorrection({ principalInCents, firstPhaseStats, secondPhaseAccumulatedFactor }) {
  if (!Number.isInteger(principalInCents) || principalInCents <= 0) throw new TypeError("principalInCents must be a positive integer");
  if (!Array.isArray(firstPhaseStats) || firstPhaseStats.length === 0) throw new TypeError("firstPhaseStats must be a non-empty array");
  if (!Number.isFinite(secondPhaseAccumulatedFactor) || secondPhaseAccumulatedFactor <= 0) throw new TypeError("secondPhaseAccumulatedFactor must be a positive finite number");

  const { accumulatedFactor: firstPhase, perMonth } = accumulateSeriesFactors(firstPhaseStats);
  const accumulatedFactor = firstPhase * secondPhaseAccumulatedFactor;
  const correctedInCents = roundCents(principalInCents * accumulatedFactor);

  return {
    accumulatedFactor,
    correctedInCents,
    correctionInCents: correctedInCents - principalInCents,
    months: [
      ...perMonth.map((month) => ({
        referenceDate: month.referenceDate,
        competence: competenceOf(month.referenceDate),
        factor: month.factor,
        accumulatedFactor: month.accumulatedFactor,
        correctedInCents: roundCents(principalInCents * month.accumulatedFactor),
      })),
      {
        referenceDate: null,
        competence: "Fase Selic (a partir de 09/12/2021)",
        factor: null,
        accumulatedFactor,
        correctedInCents,
      },
    ],
  };
}