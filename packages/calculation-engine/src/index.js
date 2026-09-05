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

function roundToSixDecimals(value) {
  const numericValue = Number(value);
  return Math.sign(numericValue) * Math.round((Math.abs(numericValue) + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export const INDEX_ACCUMULATION_METHODS = Object.freeze({
  COMPOUND_BACKWARD: "compound_backward",
  SIMPLE_RATE_BACKWARD: "simple_rate_backward",
  DIRECT_FACTOR: "direct_factor",
});

/**
 * REGRA-IND-CORE-001: núcleo configurável de acumulação de índices.
 *
 * `compound_backward`: índices de preços, como IPCA-E, IPCA, INPC e IGP-M.
 * `simple_rate_backward`: taxas não capitalizadas, como Selic e poupança na planilha de referência.
 * `direct_factor`: fator oficial já acumulado, como a tabela de atualização do INSS.
 */
export function accumulateIndexFactors(monthlyStats, options = {}) {
  const {
    method = INDEX_ACCUMULATION_METHODS.COMPOUND_BACKWARD,
    baseFactor = 1,
  } = options;

  if (!Array.isArray(monthlyStats) || monthlyStats.length === 0) {
    throw new TypeError("monthlyStats must be a non-empty array");
  }

  const normalized = monthlyStats.map(({ referenceDate, factor }, index) => {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new TypeError(`factor for ${String(referenceDate)} at position ${index + 1} must be a positive finite number`);
    }
    const timestamp = new Date(referenceDate).getTime();
    if (!Number.isFinite(timestamp)) {
      throw new TypeError(`referenceDate at position ${index + 1} must be a valid date`);
    }
    return { referenceDate, factor, timestamp };
  }).sort((left, right) => left.timestamp - right.timestamp);

  if (method === INDEX_ACCUMULATION_METHODS.DIRECT_FACTOR) {
    return {
      accumulatedFactor: normalized[0].factor,
      accumulatedRate: roundToSixDecimals(normalized[0].factor - 1),
      perMonth: normalized.map((month) => ({
        referenceDate: month.referenceDate,
        factor: month.factor,
        variation: null,
        accumulatedFactor: month.factor,
        accumulatedRate: roundToSixDecimals(month.factor - 1),
      })),
    };
  }

  if (!Number.isFinite(baseFactor) || baseFactor <= 0) {
    throw new TypeError("baseFactor must be a positive finite number");
  }

  if (method === INDEX_ACCUMULATION_METHODS.SIMPLE_RATE_BACKWARD) {
    let accumulatedRate = roundToSixDecimals(baseFactor - 1);
    const perMonth = new Array(normalized.length);
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      const month = normalized[index];
      const variation = roundToSixDecimals(month.factor - 1);
      accumulatedRate = roundToSixDecimals(accumulatedRate + variation);
      perMonth[index] = {
        referenceDate: month.referenceDate,
        factor: month.factor,
        variation,
        accumulatedRate,
        accumulatedFactor: roundToSixDecimals(1 + accumulatedRate),
      };
    }
    return {
      accumulatedFactor: roundToSixDecimals(1 + accumulatedRate),
      accumulatedRate,
      perMonth,
    };
  }

  if (method !== INDEX_ACCUMULATION_METHODS.COMPOUND_BACKWARD) {
    throw new TypeError(`unsupported index accumulation method: ${String(method)}`);
  }

  let accumulatedFactor = roundToSixDecimals(baseFactor);
  const perMonth = new Array(normalized.length);
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const month = normalized[index];
    const monthlyRate = month.factor - 1;
    const variation = roundToSixDecimals(accumulatedFactor * monthlyRate);
    accumulatedFactor = roundToSixDecimals(accumulatedFactor + variation);
    perMonth[index] = {
      referenceDate: month.referenceDate,
      factor: month.factor,
      variation,
      accumulatedRate: roundToSixDecimals(accumulatedFactor - 1),
      accumulatedFactor,
    };
  }

  return {
    accumulatedFactor,
    accumulatedRate: roundToSixDecimals(accumulatedFactor - 1),
    perMonth,
  };
}

/**
 * REGRA-IND-001: reproduz a acumulação regressiva da aba `Indice`.
 *
 * Partindo do fator-base do fim do período, cada competência é calculada
 * de trás para frente. A variação mensal é arredondada para seis casas antes
 * de ser somada ao fator da competência seguinte.
 */
export function accumulateSpreadsheetIndexFactors(monthlyStats, baseFactor = 1) {
  return accumulateIndexFactors(monthlyStats, {
    method: INDEX_ACCUMULATION_METHODS.COMPOUND_BACKWARD,
    baseFactor,
  });
}
