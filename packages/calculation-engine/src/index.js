export { sacSchedule, sacIndexedSchedule, priceSchedule, priceIndexedSchedule } from "./amortization.js";
export { judicialTwoPhaseCorrection } from "./judicial.js";
export { salaryDifferenceSchedule, detailedSalaryDifferenceSchedule } from "./salary.js";

export function applyAccumulatedFactor(principalInCents, accumulatedFactor) {
  if (!Number.isInteger(principalInCents) || principalInCents <= 0) throw new TypeError("principalInCents must be a positive integer");
  if (!Number.isFinite(accumulatedFactor) || accumulatedFactor <= 0) throw new TypeError("accumulatedFactor must be a positive finite number");
  return Math.round(principalInCents * accumulatedFactor);
}

export function accumulateSeriesFactors(monthlyStats) {
  if (!Array.isArray(monthlyStats) || monthlyStats.length === 0) throw new TypeError("monthlyStats must be a non-empty array");
  let accumulatedFactor = 1;
  const perMonth = monthlyStats.map(({ referenceDate, factor }, index) => {
    if (!Number.isFinite(factor) || factor <= 0) throw new TypeError(`factor for ${String(referenceDate)} must be a positive finite number`);
    accumulatedFactor *= factor;
    return { referenceDate, factor, accumulatedFactor };
  });
  return { accumulatedFactor, perMonth };
}
